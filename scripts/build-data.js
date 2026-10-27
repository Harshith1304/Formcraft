// Builds data/exercises.json from: free-exercise-db (images + steps), data/program.txt (user list),
// data/catalog.txt (Fitness Phantom bodyweight list) and the yoga-api dataset (LunaticPrakash).
const fs = require('fs'), path = require('path');
const P = (...a) => path.join(__dirname, '..', ...a);
const SRC = { db: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json', yoga: 'https://raw.githubusercontent.com/LunaticPrakash/yoga-api/master/yoga-api.json' };
const PHANTOM = 'https://thefitnessphantom.com/list-of-bodyweight-exercises-with-pdf';
const LV = { n: 'novice', i: 'intermediate', p: 'pro' }, LDB = { beginner: 'novice', intermediate: 'intermediate', expert: 'pro' };
const norm = s => s.toLowerCase().replace(/-/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\b(push|pull|chin|step|sit|muscle) up\b/g, '$1up').split(/\s+/).filter(Boolean).map(w => w.replace(/s$/, ''));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rows = f => fs.readFileSync(P('data', f), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => l.split('|').map(s => s.trim()));
const typeOf = f => f.includes('h') ? 'hold' : f.includes('p') ? 'cardio' : 'strength';
const YOGA_MAP = { core: 'abdominals', 'abdominal muscle': 'abdominals', back: 'middle back', spine: 'lower back', 'lower back': 'lower back', chest: 'chest', 'respiratory muscles': 'chest', neck: 'neck', thighs: 'quadriceps', quadriceps: 'quadriceps', legs: 'quadriceps', 'lower body': 'quadriceps', hamstrings: 'hamstrings', glutes: 'glutes', hip: 'glutes', hips: 'glutes', 'pelvic muscle': 'glutes', groins: 'adductors', calves: 'calves', ankle: 'ankles', ankles: 'ankles', knees: 'calves', shoulders: 'shoulders', 'upper body': 'shoulders', arms: 'biceps', wrists: 'forearms' };

(async () => {
  const get = async u => (await fetch(u)).json();
  const db = (await get(SRC.db)).filter(e => e.primaryMuscles.length), yoga = (await get(SRC.yoga)).filter(y => y.english_name);
  db.forEach(d => d._n = norm(d.name));
  const used = new Set();
  const OVR = { 'Lat Pulldown': 'Wide-Grip_Lat_Pulldown', 'Conventional Deadlift': 'Barbell_Deadlift', 'Flat Bench Barbell Press': 'Barbell_Bench_Press_-_Medium_Grip', 'Flat Bench Dumbbell Press': 'Dumbbell_Bench_Press', 'Two-Arm Dumbbell Row': 'Bent_Over_Two-Dumbbell_Row', 'Walking Lunge': 'Bodyweight_Walking_Lunge', 'Step-up': 'Step-up_with_Knee_Raise', 'T-Bar Row': 'T-Bar_Row_with_Handle' };
  const match = (name, eq) => {
    const t = norm(name), tj = t.join(' ');
    const pool = db.filter(d => eq === '*' || (eq === 'free' ? ['body only', null, 'other'].includes(d.equipment) : d.equipment === eq));
    return pool.find(d => d._n.join(' ') === tj) || pool.filter(d => t.every(w => d._n.includes(w)) && d._n.length <= t.length + 2).sort((a, b) => a._n.length - b._n.length)[0] || null;
  };
  const make = (r, d, o) => ({ id: o.id, name: r.name, muscle: r.muscles[0], muscles: r.muscles, secondary: r.muscles.slice(1), level: o.level, cats: o.cats, type: o.type,
    equipment: o.equipment, instructions: d ? d.instructions : [], source: o.source, sourceUrl: o.sourceUrl, note: o.note || '', rank: o.rank, levelText: o.levelText || '' });
  let out = []; const seen = new Set();
  for (const [name, m, l, eq, fl, note] of rows('program.txt')) {
    const d = OVR[name] ? db.find(x => x.id === OVR[name]) : match(name, eq); if (d) used.add(d.id); seen.add(norm(name).join(' '));
    out.push(make({ name, muscles: m.split(',') }, d, { id: 'p-' + slug(name), level: LV[l], cats: eq !== 'body only' ? ['gym'] : fl.includes('c') ? ['calisthenics', 'bodyweight'] : ['bodyweight'], type: typeOf(fl || ''), equipment: eq === '*' ? 'various' : eq, source: 'Program list', sourceUrl: '', note, rank: 0 }));
  }
  for (const [name, m, l, eq, fl, lt] of rows('catalog.txt')) {
    if (seen.has(norm(name).join(' '))) continue;
    const OV2 = { 'Wall Handstand Push-up': 'Handstand_Push-Ups', 'Upright Body Dip': 'Dips_-_Triceps_Version', 'Leg Kickback': 'Glute_Kickback' };
    const d = OV2[name] ? db.find(x => x.id === OV2[name]) : match(name, 'free'); if (d) used.add(d.id);;
    out.push(make({ name, muscles: m.split(',') }, d, { id: 'c-' + slug(name), level: LV[l], cats: fl.includes('c') ? ['calisthenics', 'bodyweight'] : ['bodyweight'], type: typeOf(fl), equipment: eq, source: 'The Fitness Phantom', sourceUrl: PHANTOM, rank: 1, levelText: lt }));
  }
  for (const [name, m, l, eq, fl, src, note] of rows('extras.txt')) {
    const plan = src === 'plan';
    out.push(make({ name, muscles: m.split(',') }, match(name, 'free'), { id: 'x-' + slug(name), level: LV[l], cats: fl.includes('c') ? ['calisthenics', 'bodyweight'] : ['bodyweight'], type: typeOf(fl), equipment: eq, source: plan ? 'The Fitness Phantom plan' : 'Exercise chart (user-supplied)', sourceUrl: plan ? 'https://thefitnessphantom.com' : '', note: plan ? 'Level follows the routine this move appears in.' : 'Level is an estimate; the chart gives no difficulty.', rank: 1 }));
    seen.add(norm(name).join(' '));
  }
  let skipped = 0;
  for (const y of yoga) {
    const ms = [...new Set((y.target_body_parts || []).map(t => YOGA_MAP[t.toLowerCase()]).filter(Boolean))];
    if (!ms.length) { skipped++; continue; }
    const e = make({ name: y.english_name, muscles: ms }, null, { id: 'y-' + slug(y.english_name), level: 'novice', cats: ['yoga'], type: 'hold', equipment: 'mat', source: 'yoga-api (LunaticPrakash)', sourceUrl: 'https://github.com/LunaticPrakash/yoga-api', rank: 1 });
    Object.assign(e, { alt: y.sanskrit_name, instructions: y.procedure || [], benefits: (y.benefits || []).slice(0, 4), cautions: y.contraindications || [], note: 'The source gives no difficulty rating for yoga poses, so hold time scales with your level. Read the cautions first.' });
    out.push(e);
  }
  const CAL = /pull-up|pullup|chin-up|chinup|dip|push-up|pushup|muscle-up|handstand|pistol|l-sit|planche|inverted row|hanging|burpee|mountain climber/i;
  for (const d of db) {
    if (used.has(d.id)) continue;
    const body = !d.equipment || d.equipment === 'body only';
    const type = d.category === 'stretching' ? 'mobility' : ['cardio', 'plyometrics'].includes(d.category) ? 'cardio' : 'strength';
    out.push(make({ name: d.name, muscles: [d.primaryMuscles[0], ...d.secondaryMuscles] }, d, { id: d.id, level: LDB[d.level] || 'novice', cats: body ? (type === 'strength' && CAL.test(d.name) ? ['calisthenics', 'bodyweight'] : ['bodyweight']) : ['gym'], type, equipment: d.equipment || 'none', source: 'free-exercise-db', sourceUrl: 'https://github.com/yuhonas/free-exercise-db', rank: 2 }));
  }
  // Ankle/shin work is tagged by name (no ankle muscle exists in the exercise dataset)
  for (const e of out) if (/ankle|tibialis|\bshin/i.test(e.name) && !e.muscles.includes('ankles')) { e.muscles.unshift('ankles'); e.muscle = 'ankles'; e.secondary = e.muscles.slice(1); }
  // Merge same-name duplicates (keep the best entry, union the categories)
  const STOP = new Set(['with', 'the', 'and', 'a', 'to', 'of']), key = n => norm(n).filter(w => !STOP.has(w)).sort().join(' '), by = new Map();
  for (const e of out.sort((a, c) => a.rank - c.rank || (c.instructions.length > 0) - (a.instructions.length > 0))) {
    const w = by.get(key(e.name)); if (!w) { by.set(key(e.name), e); continue; }
    w.cats = [...new Set([...w.cats, ...e.cats])];
    if (!w.instructions.length && e.instructions.length) w.instructions = e.instructions;
    if (e.benefits && !w.benefits) Object.assign(w, { benefits: e.benefits, cautions: e.cautions });
  }
  const PL = new Map(rows('plan.txt').map(r => [key(r[0]), r]));
  for (const e of by.values()) { const p = PL.get(key(e.name)); if (p) e.plan = `${p[2]} sets x ${p[1].replace(/-/g, '–')} reps`.replace('reps', /s hold/.test(p[1]) ? '' : 'reps').replace(/ hold\s*$/, ' hold').trim(); }
  console.log('merged duplicates:', out.length - by.size); out = [...by.values()];
  fs.writeFileSync(P('data', 'exercises.json'), JSON.stringify(out));
  const n = {}; out.forEach(e => e.cats.forEach(c => n[c] = (n[c] || 0) + 1));
  console.log(out.length, 'exercises', n);
})();
