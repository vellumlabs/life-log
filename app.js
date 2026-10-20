// Life Log — static PWA. Captures text / voice / images, asks Claude (BYOK, direct from the browser)
// for an entry in the repo's format (ai-diary or LLM Wiki Kit life log, see format.js), and commits it to the user's GitHub repo (Contents API).
import { systemPrompt, outputSchema } from './prompt.js';
import { fmt, CATS, diaryPath, entryNo, indexPath, dayOfWeek, parseKnown, parseSpendCats, imageFile, money } from './format.js';
import { joinSegments, rebase } from './voice.js';
import { pickLang, tr, locale } from './i18n.js';

const $ = (s) => document.querySelector(s);
const LS = 'life-log:v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch {} };
// First run in an English browser defaults to the Kit (English) format; saved settings always win.
const FIRST_FORMAT = localStorage.getItem(LS) === null && pickLang('auto', navigator.languages || [navigator.language]) === 'en' ? 'kit' : 'ai-diary';
const S = Object.assign({ key: '', model: 'claude-opus-5-5', repo: '', branch: 'main', gh: '', rules: '', format: FIRST_FORMAT, lang: 'auto', spendCats: null, known: null, knownAt: 0, days: {} }, load());
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MOCK = new URLSearchParams(location.search).has('mock');

// ---------- UI language (i18n.js). Independent of the repository format. ----------
let L = pickLang(S.lang, navigator.languages || [navigator.language]);
const t = (key, vars) => tr(L, key, vars);
function applyLang() {
  L = pickLang(S.lang, navigator.languages || [navigator.language]);
  document.documentElement.lang = L;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml); // our own static strings only
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  if (recOn) $('#btn-mic').textContent = t('micStop');
  if (!SR) $('#mic-status').textContent = t('micUnsupported');
  renderStreak(); estimate();
  if (draft && !$('#view-review').classList.contains('hidden')) { draft.markdown = $('#review-md').value; showReview(); }
}

let images = []; // {name, dataUrl, b64, mime}
let draft = null; // {date, markdown, meta, path, sha, imageFiles:[{path,b64}]}

// ---------- draft persistence (IndexedDB: images can exceed the localStorage quota) ----------
// The capture form and the Claude result survive closing the app; cleared only after save/commit or 消す.
const idb = (mode, fn) => new Promise((res, rej) => {
  const o = indexedDB.open('life-log', 1);
  o.onupgradeneeded = () => o.result.createObjectStore('kv');
  o.onerror = () => rej(o.error);
  o.onsuccess = () => { const tx = o.result.transaction('kv', mode); const r = fn(tx.objectStore('kv')); tx.oncomplete = () => res(r?.result); tx.onerror = () => rej(tx.error); };
});
let persistTimer = 0;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const d = { date: $('#date').value, text: $('#text').value, fulfill: $('#fulfill').value, skip: $('#fulfill-skip').checked, images, review: draft && { ...draft, markdown: $('#view-review').classList.contains('hidden') ? draft.markdown : $('#review-md').value }, at: Date.now() };
    const empty = !d.text.trim() && !images.length && !draft;
    idb('readwrite', (st) => (empty ? st.delete('draft') : st.put(d, 'draft'))).catch(() => {});
    $('#btn-discard').classList.toggle('hidden', empty);
  }, 300);
}
async function restore() {
  let d; try { d = await idb('readonly', (st) => st.get('draft')); } catch { return; }
  if (!d) return;
  $('#date').value = d.date || todayKey(); $('#text').value = d.text || ''; $('#fulfill').value = d.fulfill ?? 70; $('#fulfill-skip').checked = !!d.skip; fulfillUI();
  images = d.images || []; renderThumbs();
  const when = new Date(d.at).toLocaleString(locale(L), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (d.review) { draft = d.review; showReview(); $('#commit-status').textContent = t('restoredReview', { when }) + $('#commit-status').textContent; }
  else $('#compose-status').textContent = t('restoredDraft', { when }) + (images.length ? t('restoredPhotos', { n: images.length }) : '');
  $('#btn-discard').classList.remove('hidden');
}
function clearDraft() { clearTimeout(persistTimer); idb('readwrite', (st) => st.delete('draft')).catch(() => {}); $('#btn-discard').classList.add('hidden'); }

// ---------- settings ----------
function openSettings() {
  $('#s-key').value = S.key; $('#s-model').value = S.model; $('#s-repo').value = S.repo; $('#s-branch').value = S.branch; $('#s-gh').value = S.gh; $('#s-rules').value = S.rules; $('#s-format').value = S.format; $('#s-lang').value = S.lang;
  $('#settings-status').textContent = '';
  $('#dlg-settings').showModal();
}
$('#btn-settings').addEventListener('click', openSettings);
$('#form-settings').addEventListener('submit', () => {
  const repoChanged = S.repo !== $('#s-repo').value.trim() || S.format !== $('#s-format').value;
  S.format = $('#s-format').value; S.lang = $('#s-lang').value;
  S.key = $('#s-key').value.trim(); S.model = $('#s-model').value; S.repo = $('#s-repo').value.trim(); S.branch = $('#s-branch').value.trim() || 'main'; S.gh = $('#s-gh').value.trim(); S.rules = $('#s-rules').value.trim();
  if (repoChanged) { S.known = null; S.knownAt = 0; S.spendCats = null; }
  save(); applyLang();
});
$('#btn-test-gh').addEventListener('click', async () => {
  const st = $('#settings-status'); st.textContent = t('checking');
  try {
    const r = await gh(`/repos/${$('#s-repo').value.trim()}`, { token: $('#s-gh').value.trim() });
    st.textContent = t('ghOk', { name: r.full_name, branch: r.default_branch, push: t(r.permissions?.push ? 'canPush' : 'cannotPush') });
  } catch (e) { st.textContent = t('failed', { e: e.message }); }
});

// ---------- GitHub ----------
async function gh(path, { token = S.gh, method = 'GET', body } = {}) {
  const r = await fetch(`https://api.github.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
const utf8b64 = (s) => btoa(unescape(encodeURIComponent(s)));
const b64utf8 = (b) => decodeURIComponent(escape(atob(b.replace(/\n/g, ''))));
async function ghGetFile(path) { const r = await gh(`/repos/${S.repo}/contents/${encodeURI(path)}?ref=${S.branch}`); return r ? { sha: r.sha, text: r.encoding === 'base64' ? b64utf8(r.content) : r.content } : null; }
async function ghPutFile(path, b64, message, sha) { return gh(`/repos/${S.repo}/contents/${encodeURI(path)}`, { method: 'PUT', body: { message, content: b64, branch: S.branch, ...(sha ? { sha } : {}), committer: { name: 'Life Log', email: 'life-log@users.noreply.github.com' } } }); }

async function loadKnown(force = false) {
  if (!S.repo || !S.gh) return {};
  if (!force && S.known && Date.now() - S.knownAt < 6 * 3600e3) return S.known;
  const known = {};
  await Promise.all(CATS.map(async (c) => {
    try { const f = await ghGetFile(indexPath(S.format, c)); known[c] = parseKnown(S.format, f?.text); } catch { known[c] = []; }
  }));
  if (S.format === 'kit') { try { S.spendCats = parseSpendCats((await ghGetFile(indexPath('kit', 'finance')))?.text); } catch { S.spendCats = null; } }
  S.known = known; S.knownAt = Date.now(); save();
  return known;
}

// ---------- images ----------
function addFiles(files) {
  for (const f of files) {
    const img = new Image(); const url = URL.createObjectURL(f);
    img.onload = () => {
      const max = 1600, sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      const dataUrl = cv.toDataURL('image/jpeg', 0.85);
      images.push({ name: f.name, dataUrl, b64: dataUrl.split(',')[1], mime: 'image/jpeg', w: cv.width, h: cv.height });
      URL.revokeObjectURL(url); renderThumbs(); persist();
    };
    img.src = url;
  }
}
function renderThumbs() {
  estimate();
  const box = $('#thumbs'); box.innerHTML = '';
  images.forEach((im, i) => { const d = document.createElement('div'); d.className = 'thumb'; d.innerHTML = `<img src="${im.dataUrl}" alt=""><button type="button" aria-label="${t('removePhoto')}">×</button>`; d.querySelector('button').onclick = () => { images.splice(i, 1); renderThumbs(); persist(); }; box.appendChild(d); });
}
$('#file-camera').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
$('#file-pick').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });

// ---------- voice ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recOn = false;
if (!SR) { $('#btn-mic').disabled = true; $('#mic-status').textContent = t('micUnsupported'); }
$('#btn-mic').addEventListener('click', () => {
  if (recOn) { rec.stop(); return; }
  rec = new SR(); const vl = L; rec.lang = locale(vl); rec.continuous = true; rec.interimResults = true;
  const ta = $('#text'); const segs = []; // per result index: { text, final, start, end }
  let base = ta.value, sep = base ? '\n' : '', from = 0, shown = base;
  const glue = (b) => (vl === 'en' && b && !/\s$/.test(b) ? ' ' : ''); // English: keep a space between the user's text and new speech
  rec.onresult = (e) => {
    if (ta.value !== shown) { ({ base, from } = rebase(ta.value, segs, from, vl)); sep = glue(base); } // typed while recording: keep it
    const now = Date.now();
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i], s = segs[i] || (segs[i] = { start: now, end: null });
      s.text = r[0].transcript; s.final = r.isFinal; if (r.isFinal && s.end == null) s.end = now;
    }
    const out = joinSegments(segs.slice(from), 3000, vl);
    const focused = document.activeElement === ta, a = ta.selectionStart, b = ta.selectionEnd;
    ta.value = shown = base + (out && base ? sep : '') + out;
    if (focused && b <= base.length) ta.setSelectionRange(a, b); // caret stays where the user was typing
    persist(); estimate();
  };
  rec.onend = () => { recOn = false; $('#btn-mic').classList.remove('on'); $('#btn-mic').textContent = t('mic'); $('#mic-status').textContent = ''; };
  rec.onerror = (e) => { $('#mic-status').textContent = t('micError', { e: e.error }); };
  rec.start(); recOn = true; $('#btn-mic').classList.add('on'); $('#btn-mic').textContent = t('micStop'); $('#mic-status').textContent = t('micListening');
});

// ---------- cost estimate (shown before sending; rough, no API call) ----------
// $/MTok (input, output). Text ≈ 1.2 tokens/char for Japanese; images ≈ w×h/750 tokens
// (Haiku downsizes to ~1.15MP ≈ 1,600 tokens). Output = JSON entry + adaptive thinking, given as a range.
const PRICE = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5] };
const YEN = 150;
function estimate() {
  const el = $('#cost-est'); if (!el) return;
  const [pin, pout] = PRICE[S.model] || PRICE['claude-opus-5-5'];
  const sys = systemPrompt({ known: S.known, extraRules: S.rules, format: S.format, spendCats: S.spendCats }).length;
  const txt = $('#text').value.length;
  const img = images.reduce((a, im) => { const px = (im.w || 1600) * (im.h || 1200); return a + Math.round((S.model === 'claude-haiku-4-5' ? Math.min(px, 1.15e6) : px) / 750); }, 0);
  const tin = Math.round((sys + txt) * 1.2) + img + 200;
  const lo = 1500 + Math.round(txt * 1.2), hi = 4000 + Math.round(txt * 2.4);
  const usd = (o) => (tin * pin + o * pout) / 1e6;
  const photos = images.length ? t('costPhotos', { n: images.length }) : '', model = S.model, tok = tin.toLocaleString(locale(L));
  if (L === 'en') { const f = (d) => (d < 0.01 ? t('costLess1') : t('costAbout', { n: d.toFixed(3) })); el.textContent = t('cost', { lo: f(usd(lo)), hi: f(usd(hi)), model, tin: tok, photos }); return; }
  const f = (d) => (d * YEN < 1 ? t('costLess1') : t('costAbout', { n: Math.round(d * YEN) }));
  el.textContent = t('cost', { lo: f(usd(lo)), hi: f(usd(hi)).replace('約', ''), ulo: usd(lo).toFixed(3), uhi: usd(hi).toFixed(3), model, tin: tok, photos, yen: YEN });
}
$('#text').addEventListener('input', estimate);

// ---------- fulfillment ----------
const fulfillUI = () => { $('#fulfill-val').textContent = $('#fulfill-skip').checked ? '—' : `${$('#fulfill').value}/100`; $('#fulfill').disabled = $('#fulfill-skip').checked; };
$('#fulfill').addEventListener('input', fulfillUI); $('#fulfill-skip').addEventListener('change', fulfillUI); fulfillUI();
for (const id of ['#text', '#date', '#fulfill', '#fulfill-skip', '#review-md']) $(id).addEventListener('input', persist);
$('#fulfill-skip').addEventListener('change', persist);

// ---------- Claude ----------
async function callClaude({ system, userBlocks }) {
  if (MOCK) return mockResponse();
  if (!S.key) throw new Error(t('needKey'));
  const body = { model: S.model, max_tokens: 8000, system, messages: [{ role: 'user', content: userBlocks }], output_config: { format: { type: 'json_schema', schema: outputSchema } } };
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': S.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const m = await r.json();
  if (m.stop_reason === 'refusal') throw new Error(t('refusal'));
  const text = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return JSON.parse(text); } catch { const i = text.indexOf('{'), j = text.lastIndexOf('}'); return JSON.parse(text.slice(i, j + 1)); }
}
function mockResponse() {
  const d = $('#date').value; const dow = dayOfWeek(S.format, d);
  if (S.format === 'kit') {
    const w = (c, s, t) => `[${t}](../../../wiki/${c}/${s}.md)`;
    return { markdown: `# ${d} (${dow})\n\nFulfillment: 80/100\n\nPlanned the new project with ${w('people', 'sam-rivera', 'Sam')} in the morning. Lunch at ${w('shops', 'lotus-pho', 'Lotus Pho')}. Made ${w('cooking', 'red-lentil-dal', 'dal')} for dinner.\n\n## Spending\n\n| Shop | Item | Category | Amount |\n|---|---|---|---|\n| ${w('shops', 'lotus-pho', 'Lotus Pho')} | lunch | dining | $14.50 |\n\nTotal: $14.50\n${images.length ? '\n## Photos\n\n' + images.map((_, i) => `![photo ${i + 1}]({{IMG${i + 1}}})`).join('\n') + '\n' : ''}`, fulfillment: 80, entities: [{ category: 'people', name: 'sam-rivera', isNew: true }, { category: 'shops', name: 'lotus-pho', isNew: false }, { category: 'cooking', name: 'red-lentil-dal', isNew: true }], expenses_total: 14.5, images: images.map((_, i) => ({ index: i + 1, kind: 'photo', slug: `photo ${i + 1}` })), questions: ['(mock response)'] };
  }
  return { markdown: `# ${d} (${dow})\n\n充実度: 80/100\n\n## 今日のまとめ\n山田さんと打ち合わせをした。昼はサイゼリヤ。夜はカレーを作った。\n\n## 出来事\n- 午前、山田さんと新規案件の打ち合わせ\n- 昼にサイゼリヤでランチ\n- 夜にカレーを自炊\n\n## 登場人物\n- [山田さん](../../stats/people/山田さん.md) — 新規案件の打ち合わせ\n\n## お店・場所など\n- [サイゼリヤ](../../stats/shops/サイゼリヤ.md) — ランチ\n- [カレー](../../stats/cooking/カレー.md) — 夕食に自炊\n\n## 支出\n| 店 | 品目 | カテゴリ | 金額 |\n|----|------|---------|------|\n| [サイゼリヤ](../../stats/shops/サイゼリヤ.md) | ランチ | [外食](../../stats/finance/外食.md) | 980円 |\n\n合計: 980円\n${images.length ? '\n## 写真\n' + images.map((_, i) => `![写真 ${i + 1}]({{IMG${i + 1}}})`).join('\n') + '\n' : ''}`, fulfillment: 80, entities: [{ category: 'people', name: '山田さん', isNew: true }, { category: 'shops', name: 'サイゼリヤ', isNew: false }, { category: 'cooking', name: 'カレー', isNew: true }], expenses_total: 980, images: images.map((_, i) => ({ index: i + 1, kind: 'photo', slug: `写真${i + 1}` })), questions: ['（モック応答）'] };
}

// ---------- compose ----------
$('#btn-compose').addEventListener('click', async () => {
  const st = $('#compose-status'); const btn = $('#btn-compose');
  const date = $('#date').value; const text = $('#text').value.trim();
  if (!date) { st.textContent = t('needDate'); return; }
  if (!text && !images.length) { st.textContent = t('needInput'); return; }
  btn.disabled = true;
  try {
    st.textContent = t('readingRepo');
    const known = await loadKnown();
    const kit = S.format === 'kit';
    // ai-diary merges into the day's file; kit's raw/ is immutable, so the next free YYYY-MM-DD-N.md is used.
    let path = diaryPath(S.format, date), existing = null; const earlier = [];
    if (S.repo && S.gh) {
      try {
        if (fmt(S.format).merge) existing = await ghGetFile(path);
        else for (let n = 1; n <= 9; n++) { const p = diaryPath(S.format, date, n), f = await ghGetFile(p); path = p; if (!f) break; earlier.push(f.text); }
      } catch {}
    }
    const dow = dayOfWeek(S.format, date);
    const fulfill = $('#fulfill-skip').checked ? null : Number($('#fulfill').value);
    const userBlocks = [];
    images.forEach((im, i) => { userBlocks.push({ type: 'text', text: kit ? `Image ${i + 1} (placeholder {{IMG${i + 1}}}):` : `画像 ${i + 1}（プレースホルダ {{IMG${i + 1}}}）:` }); userBlocks.push({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.b64 } }); });
    userBlocks.push({ type: 'text', text: kit
      ? `Date: ${date} (${dow})\nFulfillment: ${fulfill === null ? 'not given' : fulfill}\n\nThe owner's account of the day:\n${text || '(no text; record from the images)'}${earlier.length ? `\n\nEntries already committed for this day (immutable; write only what is new):\n${earlier.join('\n\n---\n\n')}` : ''}`
      : `日付: ${date} (${dow})\n充実度: ${fulfill === null ? '記録しない' : fulfill}\n\n今日あったこと:\n${text || '（文章なし。画像から記録する）'}${existing ? `\n\n同日の既存ファイル（統合して書き直す）:\n${existing.text}` : ''}` });
    st.textContent = t('composing', { model: S.model });
    const meta = await callClaude({ system: systemPrompt({ known, extraRules: S.rules, format: S.format, spendCats: S.spendCats }), userBlocks });
    // resolve image placeholders to paths
    const imageFiles = [];
    let md = meta.markdown;
    images.forEach((im, i) => {
      const info = (meta.images || []).find((x) => x.index === i + 1) || { kind: 'photo' };
      const f = imageFile(S.format, date, info, i, entryNo(path));
      imageFiles.push({ path: f.path, b64: im.b64 });
      md = md.split(`{{IMG${i + 1}}}`).join(f.rel);
    });
    draft = { date, markdown: md, meta, path, sha: existing?.sha || null, format: S.format, imageFiles };
    showReview(); persist();
  } catch (e) { st.textContent = t('failed', { e: e.message }); }
  finally { btn.disabled = false; }
});

function showReview() {
  $('#review-path').textContent = draft.path;
  const extra = entryNo(draft.path) > 1;
  $('#review-merge').classList.toggle('hidden', !draft.sha && !extra);
  $('#review-merge').textContent = t(extra ? 'extraTag' : 'mergeTag');
  $('#review-md').value = draft.markdown;
  const q = $('#review-questions'); const qs = (draft.meta.questions || []).filter(Boolean);
  q.classList.toggle('hidden', !qs.length); q.innerHTML = qs.length ? `${esc(t('questions'))}<ul>${qs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  $('#review-entities').innerHTML = (draft.meta.entities || []).map((e) => `<span class="${e.isNew ? 'new' : ''}">${esc(e.category)}: ${esc(e.name)}${e.isNew ? esc(t('isNew')) : ''}</span>`).join('') + (draft.meta.expenses_total ? `<span>${esc(t('spend', { v: money(draft.format, draft.meta.expenses_total) }))}</span>` : '');
  $('#commit-status').textContent = S.repo && S.gh ? t('target', { repo: S.repo, branch: S.branch }) : t('noGh');
  $('#btn-commit').disabled = !(S.repo && S.gh);
  $('#btn-download').textContent = navigator.canShare && matchMedia('(pointer: coarse)').matches ? t('share') : t('saveMd');
  show('review');
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function show(name) { for (const v of document.querySelectorAll('.view')) v.classList.add('hidden'); $(`#view-${name}`).classList.remove('hidden'); window.scrollTo(0, 0); }

$('#btn-back').addEventListener('click', () => { draft.markdown = $('#review-md').value; show('capture'); persist(); });
// iOS/Android: one share sheet with the .md and all images (Web Share API level 2). Desktop or unsupported: downloads.
const b64File = (b64, name) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new File([u], name, { type: 'image/jpeg' }); };
function shareableFiles(md) {
  if (!navigator.canShare || !matchMedia('(pointer: coarse)').matches) return null;
  const imgs = draft.imageFiles.map((f) => b64File(f.b64, f.path.split('/').pop()));
  for (const type of ['text/markdown', 'text/plain']) { const files = [new File([md], draft.path.split('/').pop(), { type }), ...imgs]; try { if (navigator.canShare({ files })) return files; } catch {} }
  return null;
}
$('#btn-download').addEventListener('click', async () => {
  const md = $('#review-md').value; const files = shareableFiles(md);
  if (files) {
    try { await navigator.share({ files, title: draft.path.split('/').pop() }); markDone(t('shared', { n: files.length })); return; }
    catch (e) { if (e.name === 'AbortError') { $('#commit-status').textContent = t('shareCancelled'); return; } }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })); a.download = draft.path.split('/').pop(); a.click();
  draft.imageFiles.forEach((f, i) => { const b = document.createElement('a'); b.href = `data:image/jpeg;base64,${f.b64}`; b.download = f.path.split('/').pop(); setTimeout(() => b.click(), 200 * (i + 1)); });
  markDone(t('saved'));
});
$('#btn-commit').addEventListener('click', async () => {
  const st = $('#commit-status'); const btn = $('#btn-commit'); btn.disabled = true;
  try {
    // ai-diary: the marker tells diary-ingest what to pick up. kit: raw/ is immutable, so life-ingest finds entries without a [day] line in wiki/log.md.
    const raw = $('#review-md').value; const md = fmt(draft.format).marker && !md_has_marker(raw) ? `${raw}\n\n<!-- life-log-app: pending-stats -->\n` : raw.replace(/\s*$/, '\n');
    for (const f of draft.imageFiles) { st.textContent = t('committingImg', { path: f.path }); const ex = await gh(`/repos/${S.repo}/contents/${encodeURI(f.path)}?ref=${S.branch}`); await ghPutFile(f.path, f.b64, `diary: ${draft.date} (image)`, ex?.sha); }
    st.textContent = t('committing');
    const cur = await ghGetFile(draft.path); // re-read sha in case it changed
    if (cur && !fmt(draft.format).merge) throw new Error(t('exists', { path: draft.path }));
    const r = await ghPutFile(draft.path, utf8b64(md), `${draft.format === 'kit' ? 'raw' : 'diary'}: ${draft.date}`, cur?.sha);
    markDone(t('committed', { repo: S.repo, path: draft.path, sha: r.commit.sha.slice(0, 7) }));
  } catch (e) { st.textContent = t('failed', { e: e.message }); btn.disabled = false; }
});
const md_has_marker = (s) => s.includes('life-log-app: pending-stats');
function markDone(msg) {
  S.days[draft.date] = Date.now(); save(); clearDraft();
  $('#done-summary').textContent = msg; renderStreak(); show('done');
}
const resetCapture = () => { $('#text').value = ''; images = []; renderThumbs(); draft = null; $('#compose-status').textContent = ''; show('capture'); };
$('#btn-again').addEventListener('click', resetCapture);
$('#btn-discard').addEventListener('click', () => { if (confirm(t('discardConfirm'))) { clearDraft(); resetCapture(); $('#date').value = todayKey(); } });

function renderStreak() {
  const keys = Object.keys(S.days).sort(); let cur = 0, prev = null;
  for (const k of keys) { const d = new Date(k + 'T12:00:00'); if (prev && (d - prev) / 86400000 === 1) cur++; else cur = 1; prev = d; }
  const last = keys[keys.length - 1]; const today = todayKey();
  if (last && last !== today) { const y = new Date(today + 'T12:00:00'); y.setDate(y.getDate() - 1); if (last !== `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`) cur = 0; }
  $('#streak').textContent = cur ? t('streak', { n: cur }) : '';
}

// ---------- init ----------
$('#date').value = todayKey();
applyLang();
restore();
if (!S.key && !MOCK) setTimeout(openSettings, 300);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
