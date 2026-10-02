// Life Log — static PWA. Captures text / voice / images, asks Claude (BYOK, direct from the browser)
// for an ai-diary-formatted entry, and commits it to the user's GitHub repo (Contents API).
import { systemPrompt, outputSchema } from './prompt.js';

const $ = (s) => document.querySelector(s);
const LS = 'life-log:v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch {} };
const S = Object.assign({ key: '', model: 'claude-opus-5-5', repo: '', branch: 'main', gh: '', rules: '', known: null, knownAt: 0, days: {} }, load());
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MOCK = new URLSearchParams(location.search).has('mock');

let images = []; // {name, dataUrl, b64, mime}
let draft = null; // {date, markdown, meta, path, sha, imageFiles:[{path,b64}]}

// ---------- settings ----------
function openSettings() {
  $('#s-key').value = S.key; $('#s-model').value = S.model; $('#s-repo').value = S.repo; $('#s-branch').value = S.branch; $('#s-gh').value = S.gh; $('#s-rules').value = S.rules;
  $('#settings-status').textContent = '';
  $('#dlg-settings').showModal();
}
$('#btn-settings').addEventListener('click', openSettings);
$('#form-settings').addEventListener('submit', () => {
  const repoChanged = S.repo !== $('#s-repo').value.trim();
  S.key = $('#s-key').value.trim(); S.model = $('#s-model').value; S.repo = $('#s-repo').value.trim(); S.branch = $('#s-branch').value.trim() || 'main'; S.gh = $('#s-gh').value.trim(); S.rules = $('#s-rules').value.trim();
  if (repoChanged) { S.known = null; S.knownAt = 0; }
  save();
});
$('#btn-test-gh').addEventListener('click', async () => {
  const st = $('#settings-status'); st.textContent = '確認中…';
  try {
    const r = await gh(`/repos/${$('#s-repo').value.trim()}`, { token: $('#s-gh').value.trim() });
    st.textContent = `OK: ${r.full_name}（既定ブランチ ${r.default_branch}、${r.permissions?.push ? '書き込み可' : '書き込み不可'}）`;
  } catch (e) { st.textContent = `失敗: ${e.message}`; }
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

const CATS = ['people', 'shops', 'places', 'media', 'activities', 'cooking'];
async function loadKnown(force = false) {
  if (!S.repo || !S.gh) return {};
  if (!force && S.known && Date.now() - S.knownAt < 6 * 3600e3) return S.known;
  const known = {};
  await Promise.all(CATS.map(async (c) => {
    try { const f = await ghGetFile(`stats/${c}/index.md`); known[c] = f ? [...f.text.matchAll(/^\|\s*\[([^\]]+)\]\(/gm)].map((m) => m[1]) : []; } catch { known[c] = []; }
  }));
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
      images.push({ name: f.name, dataUrl, b64: dataUrl.split(',')[1], mime: 'image/jpeg' });
      URL.revokeObjectURL(url); renderThumbs();
    };
    img.src = url;
  }
}
function renderThumbs() {
  const t = $('#thumbs'); t.innerHTML = '';
  images.forEach((im, i) => { const d = document.createElement('div'); d.className = 'thumb'; d.innerHTML = `<img src="${im.dataUrl}" alt=""><button type="button" aria-label="削除">×</button>`; d.querySelector('button').onclick = () => { images.splice(i, 1); renderThumbs(); }; t.appendChild(d); });
}
$('#file-camera').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
$('#file-pick').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });

// ---------- voice ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recOn = false;
if (!SR) { $('#btn-mic').disabled = true; $('#mic-status').textContent = 'このブラウザは音声入力に非対応です（Safari / Chrome を使ってください）'; }
$('#btn-mic').addEventListener('click', () => {
  if (recOn) { rec.stop(); return; }
  rec = new SR(); rec.lang = 'ja-JP'; rec.continuous = true; rec.interimResults = true;
  let base = $('#text').value; let finalText = '';
  rec.onresult = (e) => { let interim = ''; finalText = ''; for (const r of e.results) { if (r.isFinal) finalText += r[0].transcript + '。'; else interim += r[0].transcript; } $('#text').value = (base ? base + '\n' : '') + finalText + interim; };
  rec.onend = () => { recOn = false; $('#btn-mic').classList.remove('on'); $('#btn-mic').textContent = '🎙 話す'; $('#mic-status').textContent = ''; };
  rec.onerror = (e) => { $('#mic-status').textContent = `音声エラー: ${e.error}`; };
  rec.start(); recOn = true; $('#btn-mic').classList.add('on'); $('#btn-mic').textContent = '■ 止める'; $('#mic-status').textContent = '聞いています…';
});

// ---------- fulfillment ----------
const fulfillUI = () => { $('#fulfill-val').textContent = $('#fulfill-skip').checked ? '—' : `${$('#fulfill').value}/100`; $('#fulfill').disabled = $('#fulfill-skip').checked; };
$('#fulfill').addEventListener('input', fulfillUI); $('#fulfill-skip').addEventListener('change', fulfillUI); fulfillUI();

// ---------- Claude ----------
async function callClaude({ system, userBlocks }) {
  if (MOCK) return mockResponse();
  if (!S.key) throw new Error('Claude の API キーを設定してください（⚙）');
  const body = { model: S.model, max_tokens: 8000, system, messages: [{ role: 'user', content: userBlocks }], output_config: { format: { type: 'json_schema', schema: outputSchema } } };
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': S.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const m = await r.json();
  if (m.stop_reason === 'refusal') throw new Error('Claude がこの内容の処理を拒否しました。表現を変えて試してください。');
  const text = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return JSON.parse(text); } catch { const i = text.indexOf('{'), j = text.lastIndexOf('}'); return JSON.parse(text.slice(i, j + 1)); }
}
function mockResponse() {
  const d = $('#date').value; const dow = '日月火水木金土'[new Date(d + 'T12:00:00').getDay()];
  return { markdown: `# ${d} (${dow})\n\n充実度: 80/100\n\n## 今日のまとめ\n山田さんと打ち合わせをした。昼はサイゼリヤ。夜はカレーを作った。\n\n## 出来事\n- 午前、山田さんと新規案件の打ち合わせ\n- 昼にサイゼリヤでランチ\n- 夜にカレーを自炊\n\n## 登場人物\n- [山田さん](../../stats/people/山田さん.md) — 新規案件の打ち合わせ\n\n## お店・場所など\n- [サイゼリヤ](../../stats/shops/サイゼリヤ.md) — ランチ\n- [カレー](../../stats/cooking/カレー.md) — 夕食に自炊\n\n## 支出\n| 店 | 品目 | カテゴリ | 金額 |\n|----|------|---------|------|\n| [サイゼリヤ](../../stats/shops/サイゼリヤ.md) | ランチ | [外食](../../stats/finance/外食.md) | 980円 |\n\n合計: 980円\n${images.length ? '\n## 写真\n' + images.map((_, i) => `![写真 ${i + 1}]({{IMG${i + 1}}})`).join('\n') + '\n' : ''}`, fulfillment: 80, entities: [{ category: 'people', name: '山田さん', isNew: true }, { category: 'shops', name: 'サイゼリヤ', isNew: false }, { category: 'cooking', name: 'カレー', isNew: true }], expenses_total: 980, images: images.map((_, i) => ({ index: i + 1, kind: 'photo', slug: `写真${i + 1}` })), questions: ['（モック応答）'] };
}

// ---------- compose ----------
$('#btn-compose').addEventListener('click', async () => {
  const st = $('#compose-status'); const btn = $('#btn-compose');
  const date = $('#date').value; const text = $('#text').value.trim();
  if (!date) { st.textContent = '日付を選んでください'; return; }
  if (!text && !images.length) { st.textContent = '何か書くか、写真を付けてください'; return; }
  btn.disabled = true;
  try {
    st.textContent = '既存の名前と同日のファイルを確認中…';
    const known = await loadKnown();
    const [y] = date.split('-'); const path = `diary/${y}/${date}.md`;
    let existing = null; if (S.repo && S.gh) { try { existing = await ghGetFile(path); } catch {} }
    const dow = '日月火水木金土'[new Date(date + 'T12:00:00').getDay()];
    const fulfill = $('#fulfill-skip').checked ? null : Number($('#fulfill').value);
    const userBlocks = [];
    images.forEach((im, i) => { userBlocks.push({ type: 'text', text: `画像 ${i + 1}（プレースホルダ {{IMG${i + 1}}}）:` }); userBlocks.push({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.b64 } }); });
    userBlocks.push({ type: 'text', text: `日付: ${date} (${dow})\n充実度: ${fulfill === null ? '記録しない' : fulfill}\n\n今日あったこと:\n${text || '（文章なし。画像から記録する）'}${existing ? `\n\n同日の既存ファイル（統合して書き直す）:\n${existing.text}` : ''}` });
    st.textContent = `Claude（${S.model}）が日記にしています…`;
    const meta = await callClaude({ system: systemPrompt({ known, extraRules: S.rules }), userBlocks });
    // resolve image placeholders to paths
    const imageFiles = [];
    let md = meta.markdown;
    images.forEach((im, i) => {
      const info = (meta.images || []).find((x) => x.index === i + 1) || { kind: 'photo', slug: `写真${i + 1}` };
      const slug = (info.slug || `写真${i + 1}`).replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 24);
      const fname = `${date}-${info.kind === 'receipt' ? 'レシート-' : ''}${slug}${i ? '-' + (i + 1) : ''}.jpg`;
      imageFiles.push({ path: `diary/${y}/images/${fname}`, b64: im.b64 });
      md = md.split(`{{IMG${i + 1}}}`).join(`images/${fname}`);
    });
    draft = { date, markdown: md, meta, path, sha: existing?.sha || null, imageFiles };
    showReview();
  } catch (e) { st.textContent = `失敗: ${e.message}`; }
  finally { btn.disabled = false; }
});

function showReview() {
  $('#review-path').textContent = draft.path;
  $('#review-merge').classList.toggle('hidden', !draft.sha);
  $('#review-md').value = draft.markdown;
  const q = $('#review-questions'); const qs = (draft.meta.questions || []).filter(Boolean);
  q.classList.toggle('hidden', !qs.length); q.innerHTML = qs.length ? `要確認:<ul>${qs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  $('#review-entities').innerHTML = (draft.meta.entities || []).map((e) => `<span class="${e.isNew ? 'new' : ''}">${esc(e.category)}: ${esc(e.name)}${e.isNew ? '（新規）' : ''}</span>`).join('') + (draft.meta.expenses_total ? `<span>支出 ${draft.meta.expenses_total.toLocaleString('ja-JP')}円</span>` : '');
  $('#commit-status').textContent = S.repo && S.gh ? `→ ${S.repo}@${S.branch}` : 'GitHub が未設定なので .md を端末に保存できます';
  $('#btn-commit').disabled = !(S.repo && S.gh);
  show('review');
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function show(name) { for (const v of document.querySelectorAll('.view')) v.classList.add('hidden'); $(`#view-${name}`).classList.remove('hidden'); window.scrollTo(0, 0); }

$('#btn-back').addEventListener('click', () => { draft.markdown = $('#review-md').value; show('capture'); });
$('#btn-download').addEventListener('click', () => {
  const md = $('#review-md').value; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })); a.download = `${draft.date}.md`; a.click();
  draft.imageFiles.forEach((f, i) => { const b = document.createElement('a'); b.href = `data:image/jpeg;base64,${f.b64}`; b.download = f.path.split('/').pop(); setTimeout(() => b.click(), 200 * (i + 1)); });
  markDone('端末に保存しました');
});
$('#btn-commit').addEventListener('click', async () => {
  const st = $('#commit-status'); const btn = $('#btn-commit'); btn.disabled = true;
  try {
    const md = $('#review-md').value + (md_has_marker($('#review-md').value) ? '' : `\n\n<!-- life-log-app: pending-stats -->\n`);
    for (const f of draft.imageFiles) { st.textContent = `画像をコミット中… ${f.path}`; const ex = await gh(`/repos/${S.repo}/contents/${encodeURI(f.path)}?ref=${S.branch}`); await ghPutFile(f.path, f.b64, `diary: ${draft.date} (image)`, ex?.sha); }
    st.textContent = '日記をコミット中…';
    const cur = await ghGetFile(draft.path); // re-read sha in case it changed
    const r = await ghPutFile(draft.path, utf8b64(md), `diary: ${draft.date}`, cur?.sha);
    markDone(`${S.repo} に ${draft.path} をコミットしました（${r.commit.sha.slice(0, 7)}）`);
  } catch (e) { st.textContent = `失敗: ${e.message}`; btn.disabled = false; }
});
const md_has_marker = (s) => s.includes('life-log-app: pending-stats');
function markDone(msg) {
  S.days[draft.date] = Date.now(); save();
  $('#done-summary').textContent = msg; renderStreak(); show('done');
}
$('#btn-again').addEventListener('click', () => { $('#text').value = ''; images = []; renderThumbs(); draft = null; show('capture'); });

function renderStreak() {
  const keys = Object.keys(S.days).sort(); let cur = 0, prev = null;
  for (const k of keys) { const d = new Date(k + 'T12:00:00'); if (prev && (d - prev) / 86400000 === 1) cur++; else cur = 1; prev = d; }
  const last = keys[keys.length - 1]; const today = todayKey();
  if (last && last !== today) { const y = new Date(today + 'T12:00:00'); y.setDate(y.getDate() - 1); if (last !== `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`) cur = 0; }
  $('#streak').textContent = cur ? `🔥 ${cur} 日連続` : '';
}

// ---------- init ----------
$('#date').value = todayKey();
renderStreak();
if (!S.key && !MOCK) setTimeout(openSettings, 300);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
