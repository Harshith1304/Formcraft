const $ = s => document.querySelector(s);
const CATS = [['', 'All'], ['calisthenics', 'Calisthenics'], ['bodyweight', 'Bodyweight'], ['yoga', 'Yoga'], ['gym', 'Gym equipment']];
const ORDER = ['calisthenics', 'yoga', 'bodyweight', 'gym'];
const SUGG = ['lower body', 'upper body', 'full body', 'thighs', 'legs', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'core', 'abdominals', 'back', 'lats', 'middle back', 'lower back', 'traps', 'chest', 'shoulders', 'arms', 'biceps', 'triceps', 'forearms', 'neck', 'ankles'];
const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
const CHEV = '<svg class="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3.5 6l4.5 4.5L12.5 6"/></svg>';
const state = { cat: '', user: null, saved: new Set(), view: 'search', pending: null, register: false };

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k.startsWith('on') ? el.addEventListener(k.slice(2), v) : el.setAttribute(k, v);
  el.append(...kids.flat().filter(k => k != null));
  return el;
}
async function api(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: r.status });
  return data;
}

// Level: one-tap segmented control
function segmented(root, labelId, options, value) {
  const ctl = { value }; root.className = 'seg'; root.setAttribute('role', 'radiogroup'); root.setAttribute('aria-labelledby', labelId);
  const paint = () => root.replaceChildren(...options.map(([v, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === ctl.value), onclick: () => { ctl.value = v; paint(); ctl.onchange && ctl.onchange(v); } }, l)));
  paint(); return ctl;
}
// Goal: custom listbox dropdown (arrows, Enter, Esc)
function dropdown(root, labelId, options, value) {
  const btn = h('button', { type: 'button', class: 'ctl', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-labelledby': labelId });
  const ul = h('ul', { class: 'list', role: 'listbox', hidden: '' }); root.append(btn, ul);
  const ctl = { value }; let idx = 0;
  const paint = () => {
    btn.innerHTML = `<span>${options.find(o => o[0] === ctl.value)[1]}</span>${CHEV}`;
    ul.replaceChildren(...options.map((o, i) => { const li = h('li', { role: 'option', 'aria-selected': String(o[0] === ctl.value), class: i === idx ? 'act' : '' });
      li.innerHTML = `<span>${o[1]}${o[2] ? `<small>${o[2]}</small>` : ''}</span>${CHECK}`; li.onmousedown = e => { e.preventDefault(); pick(i); }; return li; }));
  };
  const open = o => { ul.hidden = !o; btn.setAttribute('aria-expanded', String(o)); if (o) { idx = Math.max(0, options.findIndex(x => x[0] === ctl.value)); paint(); } };
  const pick = i => { ctl.value = options[i][0]; open(false); paint(); btn.focus(); ctl.onchange && ctl.onchange(ctl.value); };
  btn.onclick = () => open(ul.hidden); btn.onblur = () => open(false);
  btn.onkeydown = e => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); if (ul.hidden) return open(true); idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length; paint(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ul.hidden ? open(true) : pick(idx); }
    else if (e.key === 'Escape') open(false);
  };
  paint(); return ctl;
}
const level = segmented($('#level'), 'lvl-l', [['novice', 'Novice'], ['intermediate', 'Intermediate'], ['pro', 'Pro']], 'novice');
const goal = dropdown($('#goal'), 'goal-l', [['', 'Any', 'All exercise types'], ['strength', 'Strength', 'Lifts and holds'], ['endurance', 'Endurance', 'Higher reps, shorter rest'], ['cardio', 'Cardio', 'Timed work rounds']], '');
level.onchange = goal.onchange = () => $('#q').value.trim() && refresh();

// Body-part combobox
const q = $('#q'), ql = $('#qlist'); let qi = -1;
function qShow() {
  const v = q.value.toLowerCase().trim(), m = SUGG.filter(s => !v || s.includes(v)).slice(0, 8);
  ql.replaceChildren(...m.map((s, i) => { const li = h('li', { role: 'option', class: i === qi ? 'act' : '' }, h('span', {}, s)); li.onmousedown = e => { e.preventDefault(); q.value = s; qHide(); state.view = 'search'; refresh(); }; return li; }));
  ql.hidden = !m.length; q.setAttribute('aria-expanded', String(!ql.hidden));
}
const qHide = () => { ql.hidden = true; q.setAttribute('aria-expanded', 'false'); qi = -1; };
q.oninput = () => { qi = -1; qShow(); }; q.onfocus = qShow; q.onblur = qHide;
q.onkeydown = e => {
  const n = ql.children.length;
  if (e.key === 'ArrowDown' && n) { e.preventDefault(); qi = (qi + 1) % n; qShow(); }
  else if (e.key === 'ArrowUp' && n) { e.preventDefault(); qi = (qi - 1 + n) % n; qShow(); }
  else if (e.key === 'Enter' && qi >= 0) { q.value = ql.children[qi].textContent; qHide(); }
  else if (e.key === 'Escape') qHide();
};

function renderQuick() {
  const box = $('#quick'), btn = $('#open3d');
  box.prepend(...['thighs', 'lower body', 'lats', 'chest', 'core', 'shoulders'].map(s => h('button', { class: 'q', type: 'button', onclick: () => { q.value = s; state.view = 'search'; refresh(); } }, s)));
  box.prepend('Body part:'); btn.style.marginLeft = 'auto';
}
function renderNav() {
  const nav = $('#nav'); nav.replaceChildren();
  if (state.user) nav.append(
    h('button', { class: 'btn ghost', onclick: () => { state.view = state.view === 'saved' ? 'search' : 'saved'; refresh(); } }, state.view === 'saved' ? 'Back to search' : `Saved (${state.saved.size})`), ' ',
    h('button', { class: 'btn ghost', onclick: async () => { await api('/api/auth/logout', { method: 'POST' }); state.user = null; state.saved.clear(); state.view = 'search'; refresh(); } }, 'Log out'));
  else nav.append(h('button', { class: 'btn', onclick: () => openAuth(false) }, 'Log in'));
}
function renderCats(counts = null) {
  const box = $('#cats'); box.replaceChildren();
  for (const [v, label] of CATS) box.append(h('button', { class: 'cat', 'data-c': v, type: 'button', 'aria-pressed': String(state.cat === v), onclick: () => { state.cat = v; refresh(); } }, label, counts && v ? h('small', {}, String(counts[v] || 0)) : null));
}

const LV = ['novice', 'intermediate', 'pro'], cap = t => t.charAt(0).toUpperCase() + t.slice(1);
function card(e) {
  const lead = ORDER.find(c => e.cats.includes(c)) || 'gym', lv = LV.indexOf(e.level);
  const lvTxt = e.levelText ? e.levelText.replace(/Beginner/g, 'Novice').replace(/Advanced/g, 'Pro') : cap(e.level) + ' and up';
  const saved = state.saved.has(e.id), li = a => a.map(s => h('li', {}, s));
  const more = e.instructions.length || (e.benefits && e.benefits.length) || (e.cautions && e.cautions.length);
  return h('article', { class: 'card', 'data-cat': lead },
    h('div', { class: 'top' }, h('span', {}, lead === 'gym' ? 'Gym equipment' : lead), h('span', { class: 'pips', title: lvTxt }, ...[0, 1, 2].map(n => h('i', { class: n <= lv ? 'on' : '' })))),
    h('h3', {}, e.name),
    h('div', { class: 'mus' }, ...e.muscles.slice(0, 5).map((m, i) => h('span', { class: i ? '' : 'p' }, m))),
    e.rx ? h('div', { class: 'rx' }, ...[['Sets', e.rx.sets], ['Reps', e.rx.reps], ['Rest', e.rx.rest]].map(([k, v]) => h('div', {}, h('b', {}, v), h('span', {}, k)))) : null,
    h('div', { class: 'eq' }, lvTxt + ' · ' + e.equipment),
    e.plan ? h('div', { class: 'eq' }, 'Source plan: ', h('b', {}, e.plan)) : null,
    e.note ? h('div', { class: 'src' }, e.note) : null,
    more ? h('details', {}, h('summary', {}, 'Steps and tips'),
      e.instructions.length ? h('ol', {}, li(e.instructions)) : null,
      e.benefits && e.benefits.length ? h('p', {}, h('b', {}, 'Benefits: '), e.benefits.join('; ')) : null,
      e.cautions && e.cautions.length ? h('div', { class: 'caution' }, 'Cautions: ' + e.cautions.join('; ')) : null) : null,
    h('div', { class: 'foot' }, h('span', { class: 'fine' }, e.sourceUrl ? h('a', { href: e.sourceUrl, target: '_blank', rel: 'noopener' }, e.source) : e.source),
      h('button', { class: 'btn ghost save', type: 'button', 'aria-pressed': String(saved), onclick: () => toggleSave(e.id) }, saved ? 'Saved' : 'Save')));
}

async function search() {
  renderCats(); const term = q.value.trim(), out = $('#out');
  if (!term) return out.replaceChildren(h('p', { class: 'src' }, 'Choose a body part above to see exercises.'));
  out.replaceChildren(h('p', { class: 'src' }, 'Loading…'));
  const d = await api('/api/exercises?' + new URLSearchParams({ q: term, level: level.value, goal: goal.value, category: state.cat }));
  renderCats(d.counts); out.replaceChildren();
  window.Viz && window.Viz.highlight(d.muscles);
  if (d.note) out.append(h('div', { class: 'note' }, d.note));
  if (!d.groups.length && d.muscles.length) out.append(h('div', { class: 'note' }, state.cat ? 'Nothing in this category for that search and level. Choose All to see everything.' : 'No exercises match these filters.'));
  for (const g of d.groups) out.append(h('h2', { class: 'grp' }, g.muscle), h('div', { class: 'grid' }, g.items.map(card)));
}
async function showSaved() {
  const items = await api('/api/saved'); $('#cats').replaceChildren();
  $('#out').replaceChildren(h('h2', { class: 'grp' }, 'Saved cards'), items.length ? h('div', { class: 'grid' }, items.map(card)) : h('div', { class: 'note' }, 'Nothing saved yet. Search a muscle and choose Save for later.'));
}
async function toggleSave(id) {
  if (!state.user) { state.pending = id; return openAuth(false); }
  const has = state.saved.has(id);
  await api('/api/saved/' + encodeURIComponent(id), { method: has ? 'DELETE' : 'PUT' });
  has ? state.saved.delete(id) : state.saved.add(id); refresh();
}
function refresh() { renderNav(); (state.view === 'saved' ? showSaved() : search()).catch(e => $('#out').replaceChildren(h('div', { class: 'note' }, e.message))); }

function openAuth(reg) {
  state.register = reg; $('#authTitle').textContent = $('#authGo').textContent = reg ? 'Create account' : 'Log in';
  $('#authSwap').textContent = reg ? 'I already have an account' : 'Create an account';
  $('#pw').autocomplete = reg ? 'new-password' : 'current-password'; $('#err').textContent = '';
  if (!$('#auth').open) $('#auth').showModal();
}
$('#authSwap').onclick = () => openAuth(!state.register);
$('#authX').onclick = () => { state.pending = null; $('#auth').close(); };
$('#authForm').onsubmit = async ev => {
  ev.preventDefault();
  try {
    state.user = await api('/api/auth/' + (state.register ? 'register' : 'login'), { method: 'POST', body: { email: $('#em').value, password: $('#pw').value } });
    $('#pw').value = ''; $('#auth').close(); state.saved = new Set(await api('/api/saved/ids'));
    if (state.pending) { const id = state.pending; state.pending = null; await api('/api/saved/' + encodeURIComponent(id), { method: 'PUT' }); state.saved.add(id); }
    refresh();
  } catch (e) { $('#err').textContent = e.message; }
};
$('#finder').onsubmit = ev => { ev.preventDefault(); state.view = 'search'; qHide(); refresh(); };

const model = $('#model');
model.addEventListener('click', ev => { if (ev.target === model) model.close(); });
$('#open3d').onclick = () => model.showModal(); $('#close3d').onclick = () => model.close();
document.addEventListener('pickmuscle', ev => { model.close(); q.value = ev.detail; state.view = 'search'; refresh(); $('#cats').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' }); });
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => window.Viz && window.Viz.view(b.dataset.view));
document.querySelectorAll('[data-group]').forEach(b => b.onclick = () => { model.close(); q.value = b.dataset.group; state.view = 'search'; refresh(); });
(async () => { try { const me = await api('/api/me'); state.user = me.email ? me : null; if (state.user) state.saved = new Set(await api('/api/saved/ids')); } catch {} renderNav(); renderCats(); renderQuick(); search(); })();
