// Repository formats the app can write. Pure functions (no DOM) so they can be unit-tested in node.
//   ai-diary: diary/YYYY/YYYY-MM-DD.md + stats/<cat>/index.md, Japanese, yen. Same-day input is merged into the file.
//   kit:      LLM Wiki Kit Pro "life log" — raw/diary/YYYY/YYYY-MM-DD.md + wiki/<cat>/index.md, English, dollars,
//             ASCII kebab-case file names. raw/ is immutable: a second input for the day becomes YYYY-MM-DD-2.md.
export const FORMATS = {
  'ai-diary': { diaryDir: 'diary', statsDir: 'stats', merge: true, marker: true },
  kit: { diaryDir: 'raw/diary', statsDir: 'wiki', merge: false, marker: false },
};
export const fmt = (f) => FORMATS[f] || FORMATS['ai-diary'];
export const CATS = ['people', 'shops', 'places', 'media', 'activities', 'cooking'];

export function diaryPath(f, date, n = 1) { const [y] = date.split('-'); return `${fmt(f).diaryDir}/${y}/${date}${n > 1 ? `-${n}` : ''}.md`; }
export const entryNo = (path) => Number(String(path).match(/\d{4}-\d\d-\d\d-(\d+)\.md$/)?.[1] || 1); // 1 for YYYY-MM-DD.md
export const indexPath = (f, cat) => `${fmt(f).statsDir}/${cat}/index.md`;
export const dayOfWeek = (f, date) => (f === 'kit' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : '日月火水木金土')[new Date(date + 'T12:00:00').getDay()];

// Known names from a category index. ai-diary rows: | [名前](名前.md) | …   kit rows: | [[slug]] | … | In one line |
export function parseKnown(f, text) {
  if (!text) return [];
  if (f === 'kit') return [...text.matchAll(/^\|\s*\[\[([^\]|]+)\]\][^\n]*\|\s*([^|\n]*?)\s*\|\s*$/gm)].map((m) => (m[2] ? `${m[1]} (${m[2]})` : m[1]));
  return [...text.matchAll(/^\|\s*\[([^\]]+)\]\(/gm)].map((m) => m[1]);
}
// kit: names on a page's "- Also called: Mom, Ellen" line (Kit resolves names by these; the index has only slugs).
export const ALIAS_CATS = ['people', 'shops', 'places', 'activities'];
export const parseAliases = (text) => { const m = String(text || '').match(/^-\s*Also called:\s*(.+)$/m); return m ? m[1].split(',').map((x) => x.trim()).filter(Boolean) : []; };
// 'slug (one line)' + ['Mom', 'Ellen'] → 'slug (one line; also called: Mom, Ellen)'
export const withAliases = (entry, aliases) => (!aliases?.length ? entry : /\)$/.test(entry) ? `${entry.slice(0, -1)}; also called: ${aliases.join(', ')})` : `${entry} (also called: ${aliases.join(', ')})`);
export const knownSlug = (entry) => String(entry).split(' (')[0];
// Names written in committed entries whose pages don't exist yet (the ingest writes pages later). Kept on the device so the
// next entry reuses the same slug instead of inventing another; dropped once the index has the slug, or after 14 days.
export const PENDING_DAYS = 14;
export function addPending(pending, entities, date, now = Date.now()) {
  const out = (pending || []).slice();
  for (const e of entities || []) {
    if (!e?.isNew || !CATS.includes(e.category) || !e.name || out.some((p) => p.category === e.category && p.name === e.name)) continue;
    out.push({ category: e.category, name: String(e.name), date, at: now });
  }
  return out;
}
export const prunePending = (pending, known, now = Date.now()) => (pending || []).filter((p) => now - p.at < PENDING_DAYS * 864e5 && !(known?.[p.category] || []).some((k) => knownSlug(k) === p.name));
export function withPending(f, known, pending) {
  const out = Object.fromEntries(Object.entries(known || {}).map(([c, v]) => [c, v.slice()]));
  for (const p of pending || []) {
    const v = (out[p.category] ||= []);
    if (v.some((k) => knownSlug(k) === p.name)) continue;
    v.push(f === 'kit' ? `${p.name} (new on ${p.date}; page not written yet)` : p.name);
  }
  return out;
}
// kit: spending categories from wiki/finance/index.md (- [[spend-dining]] — …)
export const parseSpendCats = (text) => [...(text || '').matchAll(/^\s*-\s*\[\[spend-([a-z0-9-]+)\]\]/gm)].map((m) => m[1]);

export const kebab = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');

// Where image i (0-based) goes, and the link to it from the diary file. entry = N of YYYY-MM-DD-N.md (kit), so a
// second entry's images never overwrite the first's. kit receipts: the Receipt: line links the transcription
// raw/receipts/<name>.md (Kit convention; scripts/life-check.py reads its Total), which /life-ingest writes from the
// image of the same name. Linking the .jpg itself would break life-check for good, since raw/ is never edited.
export function imageFile(f, date, info, i, entry = 1) {
  const [y] = date.split('-'); const receipt = info?.kind === 'receipt'; const n = i ? `-${i + 1}` : '';
  if (f === 'kit') {
    const name = `${date}${entry > 1 ? `-${entry}` : ''}-${kebab(info?.slug) || (receipt ? 'receipt' : 'photo')}${n}.jpg`;
    return receipt ? { path: `raw/receipts/images/${name}`, rel: `../../receipts/${name.replace(/\.jpg$/, '.md')}` } : { path: `raw/diary/${y}/images/${name}`, rel: `images/${name}` };
  }
  const slug = (info?.slug || `写真${i + 1}`).replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 24);
  const name = `${date}-${receipt ? 'レシート-' : ''}${slug}${n}.jpg`;
  return { path: `diary/${y}/images/${name}`, rel: `images/${name}` };
}

export const money = (f, v) => (f === 'kit' ? `$${Number(v).toFixed(2)}` : `${Math.round(v).toLocaleString('ja-JP')}円`);
