'use strict';
/* TOEFL ITP Vocab — static app. Data: window.BOOK (data/words.js). Progress: localStorage. */
const LESSONS = BOOK.lessons;
const WORDS = LESSONS.flatMap(L => L.words);
const BYID = Object.fromEntries(WORDS.map(w => [w.id, w]));
const DAY = 864e5, STEPS = [0, 1, 2, 4, 8, 16, 32];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- storage ---------- */
let S;
function load() {
  try { S = JSON.parse(localStorage.getItem('tvocab1')) || {}; } catch (e) { S = {}; }
  S.w = S.w || {}; S.log = S.log || {}; S.set = S.set || { target: 85 };
}
function save() { try { localStorage.setItem('tvocab1', JSON.stringify(S)); } catch (e) { /* private mode */ } }
load();
const st = id => S.w[id] || (S.w[id] = { box: 0, due: 0, seen: 0, right: 0, wrong: 0 });
function bump() { S.log[today()] = (S.log[today()] || 0) + 1; }
function grade(id, g) { // g: 0 again,1 hard,2 good,3 easy
  const s = st(id); s.seen++; bump();
  if (g === 0) { s.box = 1; s.due = Date.now(); s.lapses = (s.lapses || 0) + 1; }
  else { s.box = Math.min(6, Math.max(1, g === 1 ? s.box : s.box + (g === 3 ? 2 : 1))); s.due = Date.now() + STEPS[s.box] * DAY; }
  save();
}
function answered(id, ok) {
  if (!id) return; const s = st(id); bump(); s.seen++;
  if (ok) { s.right++; if (s.box === 0) { s.box = 1; s.due = Date.now() + DAY; } }
  else { s.wrong++; s.box = 1; s.due = Date.now(); }
  save();
}
const isDue = id => { const s = S.w[id]; return !s || s.box === 0 || s.due <= Date.now(); };
const mastered = id => (S.w[id] || {}).box >= 4;
function streak() { let n = 0, d = new Date(); if (!S.log[today()]) d = new Date(Date.now() - DAY); for (;;) { if (S.log[d.toISOString().slice(0, 10)]) { n++; d = new Date(d - DAY); } else return n; } }

/* ---------- helpers ---------- */
function speak(t) { try { const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'; u.rate = .9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { } }
const entryFor = (k) => { k = (k || '').toLowerCase(); return WORDS.find(w => w.word.toLowerCase() === k || w.forms.some(f => f.word.toLowerCase() === k)) || WORDS.find(w => w.synonyms.some(s => s.toLowerCase() === k)); };
function blankRx(w) {
  const forms = [w.word, ...w.forms.map(f => f.word)].filter(Boolean);
  const alts = forms.map(f => { const base = f.length > 6 ? f.slice(0, f.length - 2) : f.length > 4 ? f.slice(0, f.length - 1) : f; return rx(base).replace(/ /g, '\\s+'); });
  return new RegExp('\\b(' + [...new Set(alts)].join('|') + ')\\w*', 'i');
}
const blankOut = (sent, w) => { const r = blankRx(w); return r.test(sent) ? sent.replace(r, '<span class="blank">&nbsp;</span>') : null; };
const hilite = (text, target) => {
  if (!target) return esc(text); const t = esc(text); const e = esc(target);
  for (const pat of [new RegExp('\\b' + rx(e) + '\\b', 'i'), new RegExp('\\b' + rx(e.slice(0, Math.max(4, e.length - 3))) + '\\w*', 'i')])
    if (pat.test(t)) return t.replace(pat, m => '<mark>' + m + '</mark>');
  return t;
};
const wordCard = w => `<div class="row sp"><div><span class="word">${esc(w.word)}</span> <span class="pos">${esc(w.pos)}.</span>
  <button class="btn" data-say="${esc(w.word)}" title="Phát âm">🔊</button></div><span class="chip">Lesson ${w.lesson}</span></div>
  <p>${esc(w.definition)}</p><p>≈ <span class="syn">${w.synonyms.map(esc).join(' · ')}</span></p>
  ${w.forms.length ? `<p class="mute">${w.forms.map(f => esc(f.pos) + '. ' + esc(f.word)).join(' &nbsp;·&nbsp; ')}</p>` : ''}
  ${w.examples.map(e => `<div class="ex">${hilite(e, w.word)}</div>`).join('')}`;
const lessonProg = L => { const n = L.words.length, m = L.words.filter(w => mastered(w.id)).length, s = L.words.filter(w => (S.w[w.id] || {}).box > 0).length; return { n, m, s }; };
function lessonSel(id = 'lsel', multi = false) {
  return `<select id="${id}">${multi ? '<option value="all">Tất cả 30 lesson</option>' : ''}${LESSONS.map(L => `<option value="${L.lesson}">Lesson ${L.lesson}</option>`).join('')}</select>`;
}
const pool = sel => sel === 'all' || !sel ? WORDS : (LESSONS.find(L => L.lesson === +sel) || { words: [] }).words;

/* ---------- views ---------- */
const view = { };
const app = $('#app');
let cleanup = null;

view.home = () => {
  const seen = WORDS.filter(w => (S.w[w.id] || {}).box > 0).length, mast = WORDS.filter(w => mastered(w.id)).length;
  const due = WORDS.filter(w => (S.w[w.id] || {}).box > 0 && isDue(w.id)).length;
  const tot = WORDS.reduce((a, w) => a + (S.w[w.id] ? S.w[w.id].right + S.w[w.id].wrong : 0), 0);
  const right = WORDS.reduce((a, w) => a + (S.w[w.id] ? S.w[w.id].right : 0), 0);
  const left = S.set.date ? Math.ceil((new Date(S.set.date) - new Date(today())) / DAY) : null;
  const unseen = 500 - seen;
  const plan = left > 0 ? `Còn <b>${left}</b> ngày → học khoảng <b>${Math.ceil(unseen / left)}</b> từ mới/ngày để xong 500 từ.` : left === 0 ? 'Hôm nay là ngày thi — chúc bạn tự tin!' : 'Đặt ngày thi để có kế hoạch từ mới mỗi ngày.';
  app.innerHTML = `<h1>Mục tiêu TOEFL ITP 543+</h1>
  <div class="grid">
   <div class="stat"><b>${seen}/500</b><span>từ đã gặp</span></div>
   <div class="stat"><b>${mast}</b><span>từ đã thuộc (box ≥ 4)</span></div>
   <div class="stat"><b>${due}</b><span>từ cần ôn hôm nay</span></div>
   <div class="stat"><b>${tot ? Math.round(right / tot * 100) + '%' : '—'}</b><span>đúng trong quiz (mục tiêu ${S.set.target}%)</span></div>
   <div class="stat"><b>${streak()} 🔥</b><span>ngày liên tiếp</span></div>
  </div>
  <div class="card" style="margin-top:14px"><div class="row sp"><div>${plan}</div>
   <label class="mute">Ngày thi <input type="date" id="tdate" value="${S.set.date || ''}"></label></div></div>
  <div class="row"><a class="btn pri" href="#/cards?due=1">Ôn ${due || 'từ mới'} ngay</a><a class="btn" href="#/quiz">Làm quiz</a><a class="btn" href="#/quiz?kind=mock">Thi thử</a></div>
  <h2>30 lesson</h2><div class="lessons">${LESSONS.map(L => { const p = lessonProg(L); return `<a class="lesson" href="#/learn/${L.lesson}"><b>Lesson ${L.lesson}</b>
   <div class="mute">${p.s}/${p.n} đã gặp · ${p.m} thuộc</div><div class="bar"><i style="width:${p.m / p.n * 100}%"></i></div></a>`; }).join('')}</div>
  <h2>Dữ liệu</h2><div class="row"><button class="btn" id="exp">Xuất tiến độ</button>
   <label class="btn">Nhập <input type="file" id="imp" accept=".json" hidden></label><button class="btn bad" id="rst">Xóa tiến độ</button>
   <label class="mute">Mục tiêu đúng <input type="number" id="tgt" min="50" max="100" value="${S.set.target}" style="width:70px">%</label></div>
  <p class="mute">Tiến độ chỉ lưu trong trình duyệt này. Hãy xuất file để sao lưu hoặc chuyển máy.</p>`;
  $('#tdate').onchange = e => { S.set.date = e.target.value; save(); view.home(); };
  $('#tgt').onchange = e => { S.set.target = Math.min(100, Math.max(50, +e.target.value || 85)); save(); view.home(); };
  $('#exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); a.download = 'toefl-vocab-progress.json'; a.click(); };
  $('#imp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const o = JSON.parse(t); if (!o.w) throw 0; S = o; save(); load(); view.home(); } catch (x) { alert('File không hợp lệ'); } }); };
  $('#rst').onclick = () => { if (confirm('Xóa toàn bộ tiến độ?')) { S = {}; save(); load(); view.home(); } };
};

view.learn = (arg) => {
  const n = +arg;
  if (!n) { app.innerHTML = `<h1>Học từ theo lesson</h1><div class="lessons">${LESSONS.map(L => `<a class="lesson" href="#/learn/${L.lesson}"><b>Lesson ${L.lesson}</b><div class="mute">${L.words.map(w => w.word).slice(0, 3).join(', ')}…</div></a>`).join('')}</div>`; return; }
  const L = LESSONS.find(x => x.lesson === n); if (!L) return view.home();
  app.innerHTML = `<div class="row sp"><h1>Lesson ${n}</h1><div class="row"><a class="btn" href="#/learn/${n - 1}" ${n < 2 ? 'hidden' : ''}>←</a><a class="btn" href="#/learn/${n + 1}" ${n > 29 ? 'hidden' : ''}>→</a></div></div>
  <p class="mute">Cách học gợi ý: đọc từng từ → che nghĩa, tự đoán từ đồng nghĩa → rồi mới mở ra kiểm tra.</p>
  <div class="row" style="margin-bottom:12px"><a class="btn pri" href="#/cards?lesson=${n}">Flashcard bài này</a><a class="btn" href="#/quiz?lesson=${n}&kind=match">Quiz matching</a><a class="btn" href="#/quiz?lesson=${n}&kind=context">Quiz ngữ cảnh</a></div>
  <div class="wl">${L.words.map(w => `<details class="wi"><summary><span><b>${esc(w.word)}</b> <span class="pos">${esc(w.pos)}.</span></span><span class="chip ${mastered(w.id) ? 'ok' : (S.w[w.id] || {}).box ? 'warn' : ''}">${mastered(w.id) ? 'đã thuộc' : (S.w[w.id] || {}).box ? 'đang học' : 'mới'}</span></summary><div>${wordCard(w)}</div></details>`).join('')}</div>`;
};

/* Flashcards with hint ladder (guided discovery) */
view.cards = (_, q) => {
  const sel = q.lesson || 'all';
  let mode = q.mode || 'syn', queue = [], idx = 0, step = 0, revealed = false, done = 0;
  const build = () => {
    let p = pool(sel);
    if (q.mistakes) p = p.filter(w => (S.w[w.id] || {}).wrong > 0 && !mastered(w.id));
    const dueW = p.filter(w => (S.w[w.id] || {}).box > 0 && isDue(w.id));
    const fresh = shuffle(p.filter(w => !(S.w[w.id] || {}).box)).slice(0, q.due && dueW.length ? 5 : 15);
    queue = shuffle(dueW).concat(fresh); idx = 0; step = 0; revealed = false;
  };
  const draw = () => {
    if (idx >= queue.length) {
      app.innerHTML = `<h1>Flashcard</h1><div class="card"><p><b>Xong phiên này</b> — đã ôn ${done} lượt.</p><div class="row"><button class="btn pri" id="again">Phiên mới</button><a class="btn" href="#/">Về tổng quan</a></div></div>`;
      $('#again').onclick = () => { build(); done = 0; draw(); }; return;
    }
    const w = queue[idx];
    const hints = mode === 'syn'
      ? [`Câu ví dụ: ${hilite(w.examples[0], w.word)}`, `Nghĩa: ${esc(w.definition)}`, `Từ đồng nghĩa bắt đầu bằng “${esc(w.synonyms[0][0])}”, ${w.synonyms[0].length} chữ cái`]
      : [`Từ loại: ${esc(w.pos)}.${w.forms.length ? ' Họ từ: ' + w.forms.slice(0, 2).map(f => esc(f.word)).join(', ') : ''}`, `Nghĩa: ${esc(w.definition)}`, `Bắt đầu bằng “${esc(w.word[0])}”, ${w.word.length} chữ cái`];
    const cloze = blankOut(w.examples[idx % 2], w) || blankOut(w.examples[0], w) || blankOut(w.examples[1] || '', w);
    const front = mode === 'syn'
      ? `<div class="word">${esc(w.word)} <span class="pos">${esc(w.pos)}.</span></div><p class="mute">Từ đồng nghĩa là gì?</p>`
      : `<p style="font-size:19px">${cloze || esc(w.definition)}</p><p class="mute">${cloze ? 'Điền từ đồng nghĩa với “' + esc(w.synonyms[0]) + '”' : ''} (${esc(w.pos)}.)</p>`;
    app.innerHTML = `<div class="row sp"><h1>Flashcard</h1><span class="mute">${idx + 1}/${queue.length} · ${sel === 'all' ? 'Tất cả' : 'Lesson ' + sel}</span></div>
    <div class="row" style="margin-bottom:10px"><button class="btn ${mode === 'syn' ? 'pri' : ''}" data-m="syn">Từ → đồng nghĩa</button><button class="btn ${mode === 'word' ? 'pri' : ''}" data-m="word">Ngữ cảnh → từ</button></div>
    <div class="card flash">${front}
      ${hints.slice(0, step).map(h => `<div class="hint">${h}</div>`).join('')}
      ${revealed ? '<hr style="border:0;border-top:1px solid var(--line);width:100%">' + wordCard(w) : ''}</div>
    <div class="row">${!revealed ? `<button class="btn" id="hint" ${step >= 3 ? 'disabled' : ''}>Gợi ý (${step}/3)</button><button class="btn pri" id="rev">Hiện đáp án <span class="kbd">Space</span></button>`
        : `<button class="btn bad" data-g="0">Quên <span class="kbd">1</span></button><button class="btn" data-g="1">Khó <span class="kbd">2</span></button><button class="btn ok" data-g="2">Nhớ <span class="kbd">3</span></button><button class="btn" data-g="3">Dễ <span class="kbd">4</span></button>`}</div>`;
    app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; step = 0; revealed = false; draw(); });
    const reveal = () => { revealed = true; draw(); speak(w.word); };
    if (!revealed) { $('#hint').onclick = () => { step++; draw(); }; $('#rev').onclick = reveal; }
    app.querySelectorAll('[data-g]').forEach(b => b.onclick = () => rate(+b.dataset.g));
    app._key = e => {
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
      else if (!revealed && e.key === 'h' && step < 3) { step++; draw(); }
      else if (revealed && '1234'.includes(e.key)) rate(+e.key - 1);
    };
  };
  const rate = g => { const w = queue[idx]; grade(w.id, g); done++; if (g === 0) queue.push(w); idx++; step = 0; revealed = false; draw(); };
  build();
  if (!queue.length) { app.innerHTML = `<h1>Flashcard</h1><div class="card">Không còn từ nào cần ôn ở phạm vi này. 🎉<div class="row" style="margin-top:10px"><a class="btn" href="#/cards">Chọn phạm vi khác</a><a class="btn" href="#/quiz">Làm quiz</a></div></div>`; return; }
  if (!q.lesson && !q.due && !q.mistakes && !q.go) {
    app.innerHTML = `<h1>Flashcard</h1><div class="card"><p>Chọn phạm vi ôn:</p><div class="row">${lessonSel('lsel', true)}<button class="btn pri" id="go">Bắt đầu</button></div>
    <p class="mute">Mỗi thẻ có 3 bậc gợi ý (phím <span class="kbd">H</span>) — hãy cố nhớ trước khi xem đáp án. Thẻ “Quên” quay lại cuối phiên.</p></div>`;
    $('#go').onclick = () => { location.hash = '#/cards?go=1&lesson=' + $('#lsel').value; }; return;
  }
  draw();
};

/* ---------- quiz ---------- */
function genQ(kind, ws) {
  const out = [];
  for (const w of ws) {
    const sameBox = WORDS.filter(x => x.id !== w.id && x.pos === w.pos), other = sameBox.length > 8 ? sameBox : WORDS.filter(x => x.id !== w.id);
    const d = shuffle(other).slice(0, 3);
    if (kind === 'syn') {
      const ans = w.synonyms[0], opts = shuffle([ans, ...d.map(x => x.synonyms[0])].filter((v, i, a) => a.indexOf(v) === i));
      if (opts.length < 4) continue;
      out.push({ stem: `<span class="word">${esc(w.word)}</span> <span class="pos">${esc(w.pos)}.</span>`, ask: 'Chọn từ đồng nghĩa', options: opts, answer: opts.indexOf(ans), wid: w.id });
    } else if (kind === 'def') {
      const opts = shuffle([w.word, ...d.map(x => x.word)]);
      out.push({ stem: esc(w.definition), ask: 'Định nghĩa trên là của từ nào?', options: opts, answer: opts.indexOf(w.word), wid: w.id });
    } else if (kind === 'cloze') {
      const s = blankOut(w.examples[Math.random() * 2 | 0], w) || blankOut(w.examples[0], w) || blankOut(w.examples[1] || '', w); if (!s) continue;
      const opts = shuffle([w.word, ...d.map(x => x.word)]);
      out.push({ stem: s, ask: 'Điền từ thích hợp', options: opts, answer: opts.indexOf(w.word), wid: w.id });
    }
  }
  return out;
}
function bookQ(kind, lessons) {
  const out = [];
  for (const L of lessons) {
    if (kind === 'match' || kind === 'mock') L.matching.forEach(m => out.push({ stem: `<span class="word">${esc(m.word)}</span>`, ask: 'Chọn từ đồng nghĩa (matching, theo sách)', options: m.options, answer: m.answer, wid: (entryFor(m.word) || {}).id }));
    if (kind === 'context' || kind === 'mock') L.tests.forEach(t => out.push({ passage: hilite(t.passage, t.target), stem: '', ask: t.prompt, options: t.options, answer: t.answer, wid: (entryFor(t.target) || {}).id }));
  }
  return out;
}
const KINDS = { context: 'Ngữ cảnh (đoạn văn trong sách, giống Reading ITP)', match: 'Matching đồng nghĩa (trong sách)', syn: 'Từ → đồng nghĩa (tự sinh)', def: 'Nghĩa → từ', cloze: 'Điền từ vào câu ví dụ', mock: 'Thi thử (hỗn hợp, bấm giờ)' };

view.quiz = (_, q) => {
  if (!q.run) {
    app.innerHTML = `<h1>Quiz</h1><div class="card"><div class="opts">
    <label>Dạng bài <select id="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${q.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Phạm vi <select id="lsel"><option value="all">Tất cả lesson</option><option value="mist">Chỉ từ hay sai</option>${LESSONS.map(L => `<option value="${L.lesson}" ${q.lesson == L.lesson ? 'selected' : ''}>Lesson ${L.lesson}</option>`).join('')}</select></label>
    <label>Số câu <select id="cnt"><option>10</option><option selected>20</option><option>40</option></select></label></div>
    <button class="btn pri" id="go">Bắt đầu</button></div>
    <p class="mute">Câu sai sẽ vào “Sổ lỗi sai” và được xếp lại để ôn trong flashcard.</p>`;
    $('#go').onclick = () => { location.hash = `#/quiz?run=1&kind=${$('#kind').value}&lesson=${$('#lsel').value}&n=${$('#cnt').value}`; }; return;
  }
  const kind = q.kind, sel = q.lesson || 'all', n = +q.n || 20;
  let ws = sel === 'mist' ? WORDS.filter(w => (S.w[w.id] || {}).wrong > 0) : pool(sel);
  const lessons = sel === 'all' || sel === 'mist' ? LESSONS : LESSONS.filter(L => L.lesson === +sel);
  let qs = ['context', 'match'].includes(kind) ? bookQ(kind, lessons) : kind === 'mock' ? bookQ('mock', lessons).concat(genQ('syn', shuffle(ws).slice(0, n))) : genQ(kind, shuffle(ws).slice(0, n * 2));
  if (sel === 'mist') qs = qs.filter(x => x.wid && ws.some(w => w.id === x.wid));
  if (kind === 'mock') { qs = shuffle(qs).slice(0, Math.max(n, 40)); } else qs = shuffle(qs).slice(0, n);
  if (!qs.length) { app.innerHTML = '<h1>Quiz</h1><div class="card">Chưa có câu hỏi phù hợp (có thể bạn chưa sai từ nào). <a href="#/quiz">Quay lại</a></div>'; return; }
  let i = 0, ok = 0, wrong = [], locked = false, t0 = Date.now(), limit = kind === 'mock' ? qs.length * 45 : 0, timer;
  const finish = () => {
    clearInterval(timer); app.querySelector && (app._key = null);
    const pct = Math.round(ok / qs.length * 100);
    app.innerHTML = `<h1>Kết quả</h1><div class="card"><div class="word">${ok}/${qs.length} · ${pct}%</div>
     <p class="${pct >= S.set.target ? 'syn' : 'mute'}">${pct >= S.set.target ? 'Đạt mục tiêu ' + S.set.target + '%!' : 'Chưa đạt mục tiêu ' + S.set.target + '% — xem lại các câu sai bên dưới.'}</p>
     <div class="row"><a class="btn pri" href="#/quiz">Quiz khác</a><a class="btn" href="#/cards?mistakes=1">Ôn từ sai bằng flashcard</a></div></div>
     ${wrong.length ? '<h2>Câu sai</h2>' + wrong.map(x => `<div class="card">${x.q.passage ? `<div class="passage">${x.q.passage}</div>` : ''}<p>${x.q.stem}</p><p class="mute">${esc(x.q.ask)}</p>
       <p>Bạn chọn: <span class="chip bad">${esc(x.q.options[x.pick])}</span> Đúng: <span class="chip ok">${esc(x.q.options[x.q.answer])}</span></p>${x.q.wid ? wordCard(BYID[x.q.wid]) : ''}</div>`).join('') : ''}`;
  };
  const draw = () => {
    const c = qs[i]; locked = false;
    app.innerHTML = `<div class="row sp"><span class="mute">Câu ${i + 1}/${qs.length}</span>${limit ? '<span class="timer" id="tm"></span>' : `<span class="mute">Đúng: ${ok}</span>`}</div>
    <div class="bar" style="margin:8px 0"><i style="width:${i / qs.length * 100}%"></i></div>
    <div class="card">${c.passage ? `<div class="passage">${c.passage}</div>` : ''}<p style="font-size:19px">${c.stem}</p><p class="mute">${esc(c.ask)}</p>
    <div class="opts">${c.options.map((o, k) => `<button class="opt" data-k="${k}"><span class="kbd">${k + 1}</span> ${esc(o)}</button>`).join('')}</div><div id="fb"></div></div>`;
    const pickf = k => {
      if (locked) return; locked = true;
      const right = k === c.answer; answered(c.wid, right); if (right) ok++; else wrong.push({ q: c, pick: k });
      app.querySelectorAll('.opt').forEach((b, j) => { b.disabled = true; if (j === c.answer) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
      $('#fb').innerHTML = `${c.wid ? wordCard(BYID[c.wid]) : ''}<div class="row" style="margin-top:10px"><button class="btn pri" id="next">${i + 1 < qs.length ? 'Câu tiếp' : 'Xem kết quả'} <span class="kbd">Enter</span></button></div>`;
      $('#next').onclick = next;
    };
    const next = () => { i++; i < qs.length ? draw() : finish(); };
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => pickf(+b.dataset.k));
    app._key = e => { if ('1234'.includes(e.key) && !locked) pickf(+e.key - 1); else if (locked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); } };
    if (limit) { const tick = () => { const r = limit - (Date.now() - t0) / 1000; const el = $('#tm'); if (r <= 0) return finish(); if (el) el.textContent = '⏱ ' + Math.floor(r / 60) + ':' + String(Math.floor(r % 60)).padStart(2, '0'); }; clearInterval(timer); timer = setInterval(tick, 500); tick(); }
  };
  cleanup = () => clearInterval(timer);
  draw();
};

view.mistakes = () => {
  const ws = WORDS.filter(w => (S.w[w.id] || {}).wrong > 0).sort((a, b) => S.w[b.id].wrong - S.w[a.id].wrong);
  app.innerHTML = `<h1>Sổ lỗi sai</h1>${ws.length ? `<div class="row" style="margin-bottom:12px"><a class="btn pri" href="#/cards?mistakes=1">Ôn flashcard</a><a class="btn" href="#/quiz?run=1&kind=syn&lesson=mist&n=20">Quiz từ hay sai</a></div>
  <div class="wl">${ws.map(w => `<details class="wi"><summary><span><b>${esc(w.word)}</b> → ${esc(w.synonyms[0])}</span><span class="chip bad">sai ${S.w[w.id].wrong} · đúng ${S.w[w.id].right}</span></summary><div>${wordCard(w)}</div></details>`).join('')}</div>` : '<div class="card">Chưa có từ nào bị sai. Làm vài quiz rồi quay lại nhé.</div>'}`;
};

view.search = () => {
  app.innerHTML = `<h1>Tra từ</h1><input type="text" id="q" placeholder="Gõ từ, nghĩa hoặc từ đồng nghĩa…" autofocus><div class="wl" id="res" style="margin-top:12px"></div>`;
  const run = () => {
    const k = $('#q').value.trim().toLowerCase();
    const r = k ? WORDS.filter(w => [w.word, w.definition, ...w.synonyms, ...w.forms.map(f => f.word)].some(s => s.toLowerCase().includes(k))) : WORDS.slice(0, 30);
    $('#res').innerHTML = r.slice(0, 60).map(w => `<details class="wi"><summary><span><b>${esc(w.word)}</b> <span class="pos">${esc(w.pos)}.</span> → ${esc(w.synonyms.join(', '))}</span><span class="chip">L${w.lesson}</span></summary><div>${wordCard(w)}</div></details>`).join('') || '<div class="card">Không tìm thấy.</div>';
  };
  $('#q').oninput = run; run();
};

/* ---------- router ---------- */
function route() {
  if (cleanup) { cleanup(); cleanup = null; } app._key = null;
  const h = location.hash.replace(/^#\/?/, ''), [path, qs] = h.split('?'), [name, arg] = path.split('/');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === (name || '')));
  (view[name || 'home'] || view.home)(arg, q); scrollTo(0, 0);
}
addEventListener('hashchange', route);
addEventListener('keydown', e => { if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.metaKey) return; if (app._key) app._key(e); });
app.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) { e.preventDefault(); speak(b.dataset.say); } });
route();
