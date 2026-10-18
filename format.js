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
// kit: spending categories from wiki/finance/index.md (- [[spend-dining]] — …)
export const parseSpendCats = (text) => [...(text || '').matchAll(/^\s*-\s*\[\[spend-([a-z0-9-]+)\]\]/gm)].map((m) => m[1]);

export const kebab = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');

// Where image i (0-based) goes, and the link to it from the diary file. entry = N of YYYY-MM-DD-N.md (kit), so a
// second entry's images never overwrite the first's.
export function imageFile(f, date, info, i, entry = 1) {
  const [y] = date.split('-'); const receipt = info?.kind === 'receipt'; const n = i ? `-${i + 1}` : '';
  if (f === 'kit') {
    const name = `${date}${entry > 1 ? `-${entry}` : ''}-${kebab(info?.slug) || (receipt ? 'receipt' : 'photo')}${n}.jpg`;
    return receipt ? { path: `raw/receipts/images/${name}`, rel: `../../receipts/images/${name}` } : { path: `raw/diary/${y}/images/${name}`, rel: `images/${name}` };
  }
  const slug = (info?.slug || `写真${i + 1}`).replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 24);
  const name = `${date}-${receipt ? 'レシート-' : ''}${slug}${n}.jpg`;
  return { path: `diary/${y}/images/${name}`, rel: `images/${name}` };
}

export const money = (f, v) => (f === 'kit' ? `$${Number(v).toFixed(2)}` : `${Math.round(v).toLocaleString('ja-JP')}円`);
