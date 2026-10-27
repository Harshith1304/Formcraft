const path = require('path');
try { for (const l of require('fs').readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch { /* .env is optional */ }
const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const db = require('./db');
const ready = db.init();
ready.catch(() => {});
const A = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const PROD = process.env.NODE_ENV === 'production';
const SECRET = process.env.JWT_SECRET || (PROD ? null : 'dev-only-secret-change-me');
// Without JWT_SECRET in production the site still serves search; only login and saving are disabled (503) instead of crashing.
if (!SECRET) console.warn('JWT_SECRET is not set: login and saved cards are disabled.');

const EX = require('./data/exercises.json');
EX.forEach(e => { e.muscles = e.muscles || [e.muscle]; });
const BY = new Map(EX.map(e => [e.id, e]));

// ---- Programming templates (see README for sources) ----
const RX = {
  strength:  { novice: { sets: '2', reps: '6–8', rest: '90 s' }, intermediate: { sets: '3', reps: '8–10', rest: '75 s' }, pro: { sets: '4–5', reps: '10–12', rest: '60 s' } },
  endurance: { novice: { sets: '2', reps: '10–12', rest: '60 s' }, intermediate: { sets: '3', reps: '15–18', rest: '45 s' }, pro: { sets: '4–5', reps: '20–25', rest: '30 s' } },
  cardio:    { novice: { sets: '3 rounds', reps: '30 s work', rest: '60 s' }, intermediate: { sets: '4–5 rounds', reps: '40 s work', rest: '40 s' }, pro: { sets: '6–8 rounds', reps: '45 s work', rest: '20 s' } },
  hold:      { novice: { sets: '2', reps: '15–20 s hold', rest: '45 s' }, intermediate: { sets: '3', reps: '25–40 s hold', rest: '45 s' }, pro: { sets: '4', reps: '45–60 s hold', rest: '30 s' } },
  mobility:  { novice: { sets: '2', reps: '15–20 s hold', rest: '15 s' }, intermediate: { sets: '3', reps: '20–30 s hold', rest: '15 s' }, pro: { sets: '4', reps: '30–45 s hold', rest: '10 s' } },
};
const TIPS = {
  novice: 'Learn the movement with an easier variation or light load before progressing.',
  intermediate: 'Add load or reps gradually once you complete the top of the rep range with good form.',
  pro: 'Vary volume and intensity across weeks (periodisation) instead of maxing every session.',
};
const RANK = { novice: 0, intermediate: 1, pro: 2 };

// ---- Body-part resolution ----
const LOWER = ['quadriceps', 'hamstrings', 'glutes', 'calves', 'ankles', 'adductors', 'abductors'];
const UPPER = ['chest', 'lats', 'middle back', 'shoulders', 'biceps', 'triceps', 'traps', 'forearms', 'neck'];
const GROUPS = {
  'lower body': LOWER, legs: LOWER, thighs: ['quadriceps', 'hamstrings', 'adductors', 'abductors'], 'feet and ankles': ['ankles', 'calves'],
  'upper body': UPPER, back: ['lats', 'middle back', 'lower back', 'traps'], arms: ['biceps', 'triceps', 'forearms'],
  core: ['abdominals', 'lower back'], abs: ['abdominals'], 'full body': [...LOWER, ...UPPER, 'abdominals'],
};
const ALIAS = { quads: 'quadriceps', quad: 'quadriceps', hamstring: 'hamstrings', glute: 'glutes', butt: 'glutes', calf: 'calves', lat: 'lats', pecs: 'chest', delts: 'shoulders', shoulder: 'shoulders', bicep: 'biceps', tricep: 'triceps', trap: 'traps', forearm: 'forearms', ab: 'abdominals', stomach: 'abdominals', 'upper back': 'middle back', shin: 'ankles', shins: 'ankles', tibia: 'ankles', tibialis: 'ankles', ankle: 'ankles', delt: 'shoulders', 'lower-back': 'lower back' };
const MUSCLES = [...new Set(EX.flatMap(e => e.muscles))];

function resolve(q) {
  q = q.toLowerCase().trim();
  if (!q) return { muscles: [] };
  const parts = q.split(/[,&]| and /).map(s => s.trim()).filter(Boolean);
  const out = new Set(); let note = '';
  for (const p of parts) {
    const a = ALIAS[p] || p;
    if (GROUPS[a]) GROUPS[a].forEach(m => out.add(m));
    else if (MUSCLES.includes(a)) out.add(a);
    else MUSCLES.filter(m => m.startsWith(a.replace(/s$/, ''))).forEach(m => out.add(m));
    if (/tibia|shin/.test(p)) note = 'Shin and tibialis work is grouped under ankles.';
  }
  return { muscles: [...out], note };
}

// ---- App ----
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  upgradeInsecureRequests: PROD ? [] : null, fontSrc: ['https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"] } } }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', (req, res, next) => ready.then(() => next(), next));

app.use(['/api/auth', '/api/saved'], (req, res, next) => SECRET ? next() : res.status(503).json({ error: 'Login is not configured on this server yet.' }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 30 * 24 * 3600 * 1000 };
const sign = u => jwt.sign({ uid: u.id }, SECRET, { expiresIn: '30d' });
const DUMMY = bcrypt.hashSync('timing-equalizer', 12);

function auth(req, res, next) {
  try { req.uid = jwt.verify(req.cookies.token, SECRET).uid; next(); }
  catch { res.status(401).json({ error: 'Log in to continue.' }); }
}
function creds(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) { res.status(400).json({ error: 'Enter a valid email address.' }); return null; }
  if (password.length < 10 || password.length > 128) { res.status(400).json({ error: 'Password must be 10–128 characters.' }); return null; }
  return { email, password };
}

app.post('/api/auth/register', authLimiter, A(async (req, res) => {
  const c = creds(req, res); if (!c) return;
  if (await db.get('SELECT 1 AS x FROM users WHERE email=?', [c.email])) return res.status(409).json({ error: 'That email is already registered. Log in instead.' });
  const u = await db.get('INSERT INTO users(email,hash) VALUES(?,?) RETURNING id', [c.email, await bcrypt.hash(c.password, 12)]);
  res.cookie('token', sign({ id: Number(u.id) }), cookieOpts).status(201).json({ email: c.email });
}));
app.post('/api/auth/login', authLimiter, A(async (req, res) => {
  const c = creds(req, res); if (!c) return;
  const u = await db.get('SELECT id,hash FROM users WHERE email=?', [c.email]);
  const ok = await bcrypt.compare(c.password, u ? u.hash : DUMMY);
  if (!u || !ok) return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.cookie('token', sign({ id: Number(u.id) }), cookieOpts).json({ email: c.email });
}));
app.post('/api/auth/logout', (req, res) => res.clearCookie('token', cookieOpts).json({ ok: true }));
app.get('/api/me', A(async (req, res) => {
  let uid; try { uid = jwt.verify(req.cookies.token, SECRET).uid; } catch { return res.json({ email: null }); }
  res.json((await db.get('SELECT email FROM users WHERE id=?', [uid])) || { email: null });
}));

app.get('/api/exercises', (req, res) => {
  const level = RANK[req.query.level] !== undefined ? req.query.level : 'novice';
  const cat = String(req.query.category || ''), goal = String(req.query.goal || '');
  const { muscles, note } = resolve(String(req.query.q || '').slice(0, 60));
  if (!muscles.length) return res.json({ muscles, groups: [], counts: {}, note: 'No matching body part. Try "thighs", "lats", "lower body" or "core".' });
  const set = new Set(muscles);
  let pool = EX.filter(e => e.muscles.some(m => set.has(m)) && RANK[e.level] <= RANK[level]);
  if (goal === 'strength') pool = pool.filter(e => ['strength', 'hold'].includes(e.type));
  else if (goal === 'cardio') pool = pool.filter(e => e.type === 'cardio');
  else if (goal === 'endurance') pool = pool.filter(e => e.type !== 'mobility');
  const counts = {}; pool.forEach(e => e.cats.forEach(c => counts[c] = (counts[c] || 0) + 1));
  if (cat) pool = pool.filter(e => e.cats.includes(cat));
  const withRx = e => ({ ...e, rx: RX[goal === 'endurance' && e.type === 'strength' ? 'endurance' : e.type][level] });
  const order = ['calisthenics', 'yoga', 'bodyweight', 'gym'], lead = e => order.find(c => e.cats.includes(c));
  const EQW = new Set(['barbell', 'dumbbell', 'band', 'bodyweight', 'body', 'machine', 'cable', 'kettlebell', 'smith', 'lever', 'ball', 'medicine', 'exercise', 'stability', 'resistance', 'trx', 'plate', 'weighted', 'ez', 'bar', 'with', 'the', 'and', 'a', 'medium', 'alternate', 'alternating', 'chain']);
  const FAM = ['pushup', 'pullup', 'chinup', 'squat', 'deadlift', 'lunge', 'press', 'curl', 'row', 'raise', 'fly', 'extension', 'dip', 'crunch', 'bridge', 'thrust', 'shrug', 'pulldown', 'twist', 'kickback', 'jump', 'snatch', 'clean', 'swing'];
  const fam = e => { const n = e.name.toLowerCase().replace(/\b(push|pull|chin)[- ]?ups?\b/g, '$1up').replace(/[^a-z ]/g, ' '); return FAM.find(f => n.split(/\s+/).some(w => w === f || w === f + 's')); };
  const stem = e => e.name.toLowerCase().replace(/\b(push|pull|chin|sit|step|muscle)[- ]?ups?\b/g, '$1up').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map(w => w.replace(/s$/, '')).filter(w => !EQW.has(w)).sort().join(' ');
  const groups = muscles.map(m => {
    const mine = pool.filter(e => e.muscles.find(x => set.has(x)) === m).sort((a, b) => a.rank - b.rank || (b.level === level) - (a.level === level));
    const seenStem = new Set(), famCount = {}, buckets = {};
    mine.forEach(e => { if (e.rank) { const k = lead(e) + '|' + stem(e); if (seenStem.has(k)) return; seenStem.add(k); const f = fam(e); if (f) { const fk = lead(e) + '|' + f; if ((famCount[fk] = (famCount[fk] || 0) + 1) > 2) return; } } (buckets[lead(e)] ||= []).push(e); });
    const items = [];
    while (items.length < 24 && Object.values(buckets).some(b => b.length)) for (const k of order) if (buckets[k]?.length && items.length < 24) items.push(buckets[k].shift());
    return { muscle: m, items: items.map(withRx) };
  }).filter(g => g.items.length);
  res.json({ muscles, groups, counts, note, tip: TIPS[level] });
});

app.get('/api/saved', auth, A(async (req, res) => {
  const rows = await db.all('SELECT exercise_id FROM saved WHERE user_id=? ORDER BY created DESC', [req.uid]);
  res.json(rows.map(r => BY.get(r.exercise_id)).filter(Boolean));
}));
app.put('/api/saved/:id', auth, A(async (req, res) => {
  if (!BY.has(req.params.id)) return res.status(404).json({ error: 'Unknown exercise.' });
  await db.run('INSERT INTO saved(user_id,exercise_id) VALUES(?,?) ON CONFLICT DO NOTHING', [req.uid, req.params.id]); res.json({ ok: true });
}));
app.delete('/api/saved/:id', auth, A(async (req, res) => { await db.run('DELETE FROM saved WHERE user_id=? AND exercise_id=?', [req.uid, req.params.id]); res.json({ ok: true }); }));
app.get('/api/saved/ids', auth, A(async (req, res) => res.json((await db.all('SELECT exercise_id FROM saved WHERE user_id=?', [req.uid])).map(r => r.exercise_id))));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error. Please try again.' }); });

if (!process.env.VERCEL) app.listen(process.env.PORT || 3000, () => console.log('Running on http://localhost:' + (process.env.PORT || 3000)));
module.exports = app;
