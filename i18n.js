// UI strings (ja / en). Pure (no DOM) so the dictionary can be checked in node: every key exists in both languages.
// The UI language is independent of the repository format (format.js): a Japanese speaker can keep a Kit (English) wiki.
// pref: 'auto' | 'ja' | 'en'. auto = Japanese when the browser prefers Japanese, otherwise English.
export const LANGS = ['ja', 'en'];
export function pickLang(pref, navLangs = []) {
  if (LANGS.includes(pref)) return pref;
  const first = [...navLangs].find(Boolean) || 'en';
  return /^ja\b/i.test(first) ? 'ja' : 'en';
}

export const STR = {
  ja: {
    title: 'Life Log — 日記の入口',
    streakTitle: '連続記録日数', settings: '設定',
    date: '日付', text: '今日あったこと',
    textPh: '話すか、書く。例: 午前は山田さんと打ち合わせ。昼はサイゼで 980 円。夜は自炊でカレー。充実度 80。',
    mic: '🎙 話す', micStop: '■ 止める', micListening: '聞いています…', micUnsupported: 'このブラウザは音声入力に非対応です（Safari / Chrome を使ってください）', micError: '音声エラー: {e}',
    photos: '写真・レシート', camera: '📷 撮る', pick: '🖼 選ぶ', removePhoto: '削除',
    fulfill: '充実度', fulfillSkip: '今日は付けない',
    compose: 'Claude で日記にする', discard: '下書きを消す',
    mergeTag: '同日の既存ファイルに統合', extraTag: '同日の既存の日記は変えずに追加分として新規作成',
    back: '← 直す', saveMd: '.md を保存', share: '共有・保存', commit: 'GitHub にコミット',
    doneTitle: '記録しました',
    doneNote: '統計（人物・店・支出）の更新は、リポジトリ側の Claude Code で <code>/diary-ingest</code>（Kit 形式は <code>/life-ingest</code>）を実行してください（このアプリは入口だけを担当します）。',
    again: '続けて書く',
    footer: '<b>Life Log</b> は <a href="https://github.com/vellumlabs" rel="noopener">Vellum Labs</a>（LLM が運営する小さなスタジオ）が作っています。サーバはありません。API キーと GitHub トークンはこの端末の localStorage にだけ保存され、通信先は Anthropic と GitHub だけです。コードは Claude Code（AI）で書きました。',
    sKey: 'API キー', sModel: 'モデル', mOpus: 'claude-opus-5-5（既定・精度重視）', mSonnet: 'claude-sonnet-5-5（速い・安い）', mHaiku: 'claude-haiku-4-5（最安）',
    sGhHead: 'GitHub（任意。無ければ .md を端末に保存）', sRepo: 'リポジトリ', repoPh: 'owner/ai-diary', sBranch: 'ブランチ', sToken: 'Personal Access Token（contents: write）',
    sRulesHead: '日記の規約', sFormat: 'リポジトリの形式', fAiDiary: 'ai-diary 型（日本語・円）', fKit: 'Kit Pro の life log（英語・$）',
    sRules: '追加の指示（任意）', sRulesPh: '例: 猫の名前は『みけ』。会社名は書かない。',
    sRulesNote: '規約の本体（常体・簡潔、充実度、支出テーブル、エンティティへの相対リンク）はアプリに組み込み済みです。リポジトリの <code>stats/*/index.md</code>（Kit 形式は <code>wiki/*/index.md</code>）から既存の人物・店・場所などの名前を読み取り、同じ名前にリンクします。',
    sLang: '表示言語 / Language', lAuto: '自動（ブラウザに合わせる）',
    testGh: 'GitHub 接続を確認', save: '保存',
    checking: '確認中…', ghOk: 'OK: {name}（既定ブランチ {branch}、{push}）', canPush: '書き込み可', cannotPush: '書き込み不可', failed: '失敗: {e}',
    restoredReview: '{when} の確認待ちを復元しました。', restoredDraft: '{when} の下書きを復元しました', restoredPhotos: '（写真 {n} 枚）',
    costLess1: '1円未満', costAbout: '約{n}円',
    cost: '費用の目安: {lo}〜{hi}（${ulo}〜{uhi}、{model}、入力 約{tin} トークン{photos}、1$={yen}円）', costPhotos: '・写真 {n} 枚',
    needKey: 'Claude の API キーを設定してください（⚙）', refusal: 'Claude がこの内容の処理を拒否しました。表現を変えて試してください。',
    needDate: '日付を選んでください', needInput: '何か書くか、写真を付けてください',
    readingRepo: '既存の名前と同日のファイルを確認中…', composing: 'Claude（{model}）が日記にしています…',
    questions: '要確認:', isNew: '（新規）', spend: '支出 {v}',
    target: '→ {repo}@{branch}', noGh: 'GitHub が未設定なので .md を端末に保存できます',
    shared: '共有シートで保存しました（{n} ファイル）', shareCancelled: '共有を取り消しました（下書きは残っています）', saved: '端末に保存しました',
    committingImg: '画像をコミット中… {path}', committing: '日記をコミット中…',
    exists: '{path} が既にあります（raw は上書きしません）。「戻る」→ もう一度「Claude で日記にする」で次の番号になります',
    committed: '{repo} に {path} をコミットしました（{sha}）',
    discardConfirm: '下書き（文章・写真・確認待ちの日記）を消しますか？',
    streak: '🔥 {n} 日連続',
  },
  en: {
    title: 'Life Log — a front door for your diary',
    streakTitle: 'Days in a row', settings: 'Settings',
    date: 'Date', text: 'What happened today',
    textPh: 'Talk or type. e.g. Planned the launch with Sam in the morning. Lunch at Lotus Pho, $14.50. Cooked dal for dinner. Fulfillment 80.',
    mic: '🎙 Talk', micStop: '■ Stop', micListening: 'Listening…', micUnsupported: 'This browser has no voice input (use Safari or Chrome)', micError: 'Voice error: {e}',
    photos: 'Photos & receipts', camera: '📷 Camera', pick: '🖼 Choose', removePhoto: 'Remove',
    fulfill: 'Fulfillment', fulfillSkip: 'Skip today',
    compose: 'Write it up with Claude', discard: 'Discard draft',
    mergeTag: 'Merged into the existing file for this day', extraTag: 'New entry; earlier entries for this day stay unchanged',
    back: '← Edit', saveMd: 'Save .md', share: 'Share / Save', commit: 'Commit to GitHub',
    doneTitle: 'Saved',
    doneNote: 'To update the stats (people, places, spending), run <code>/life-ingest</code> (ai-diary format: <code>/diary-ingest</code>) with Claude Code in the repository. This app is only the front door.',
    again: 'Write another',
    footer: '<b>Life Log</b> is made by <a href="https://github.com/vellumlabs" rel="noopener">Vellum Labs</a>, a small studio run by an LLM. There is no server: your API key and GitHub token stay in this device\'s localStorage, and the app talks only to Anthropic and GitHub. The code was written with Claude Code (AI).',
    sKey: 'API key', sModel: 'Model', mOpus: 'claude-opus-5-5 (default, best)', mSonnet: 'claude-sonnet-5-5 (faster, cheaper)', mHaiku: 'claude-haiku-4-5 (cheapest)',
    sGhHead: 'GitHub (optional; without it you save the .md to this device)', sRepo: 'Repository', repoPh: 'owner/life-log', sBranch: 'Branch', sToken: 'Personal access token (contents: write)',
    sRulesHead: 'Diary conventions', sFormat: 'Repository format', fAiDiary: 'ai-diary (Japanese, yen)', fKit: 'Kit Pro life log (English, $)',
    sRules: 'Extra instructions (optional)', sRulesPh: 'e.g. The cat is called Miso. Never write my employer\'s name.',
    sRulesNote: 'The core conventions (plain and short, fulfillment, spending table, relative links to entities) are built in. The app reads existing names of people, shops, places and more from <code>wiki/*/index.md</code> (ai-diary format: <code>stats/*/index.md</code>) and links to the same names.',
    sLang: 'Language / 表示言語', lAuto: 'Auto (follow the browser)',
    testGh: 'Test GitHub connection', save: 'Save',
    checking: 'Checking…', ghOk: 'OK: {name} (default branch {branch}, {push})', canPush: 'can push', cannotPush: 'read-only', failed: 'Failed: {e}',
    restoredReview: 'Restored the entry waiting for review from {when}. ', restoredDraft: 'Restored the draft from {when}', restoredPhotos: ' ({n} photos)',
    costLess1: 'under $0.01', costAbout: '${n}',
    cost: 'Estimated cost: {lo} to {hi} ({model}, about {tin} input tokens{photos})', costPhotos: ', {n} photos',
    needKey: 'Set your Claude API key first (⚙)', refusal: 'Claude declined to process this. Try rewording it.',
    needDate: 'Pick a date', needInput: 'Write something or add a photo',
    readingRepo: 'Checking known names and entries for this day…', composing: 'Claude ({model}) is writing the entry…',
    questions: 'Please check:', isNew: ' (new)', spend: 'Spent {v}',
    target: '→ {repo}@{branch}', noGh: 'GitHub is not set up, so you can save the .md to this device',
    shared: 'Saved via the share sheet ({n} files)', shareCancelled: 'Share cancelled (the draft is kept)', saved: 'Saved to this device',
    committingImg: 'Committing image… {path}', committing: 'Committing the entry…',
    exists: '{path} already exists (raw files are never overwritten). Go back and press "Write it up with Claude" again to get the next number.',
    committed: 'Committed {path} to {repo} ({sha})',
    discardConfirm: 'Discard the draft (text, photos and the entry waiting for review)?',
    streak: '🔥 {n} days in a row',
  },
};

export const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
export const tr = (lang, key, vars) => fill(STR[lang]?.[key] ?? STR.ja[key] ?? key, vars);
export const locale = (lang) => (lang === 'en' ? 'en-US' : 'ja-JP');
