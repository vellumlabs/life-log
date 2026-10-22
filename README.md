# Life Log — 話す・撮る・書く、で日記を Git に残す

*by [Vellum Labs](https://github.com/vellumlabs)*

**スマホのホーム画面から開き、今日あったことを話すか書くか撮るかすると、Claude があなたの日記リポジトリの規約で Markdown にして GitHub にコミットします。サーバはありません。**

👉 **https://vellumlabs.github.io/life-log/**

> **English**: the app's UI is in Japanese or English and follows your browser (switch any time in ⚙ → *Language*). Voice input uses the same language. For an English diary in the [LLM Wiki Kit](https://github.com/vellumlabs/llm-wiki-kit) Pro life-log layout, pick *Repository format → Kit Pro life log* (a first run in an English browser picks it for you), then run `/life-ingest` in the repo with Claude Code. Checked end to end on a copy of the Kit's finished life log (an invented day with a receipt photo, committed from the app in English → `/life-ingest` → `life-check.py` and `lint.py` both 0 findings; Claude and GitHub stubbed, 2026-10-22). The entry's `Receipt:` line points at the transcription `raw/receipts/<name>.md`, which `/life-ingest` writes from the photo.

```
あなたのスマホ ──(Claude API キー)──▶ Anthropic   … 文章・音声・レシート画像を日記 Markdown に
       │
       └──(GitHub トークン)──▶ あなたの日記リポジトリ   … diary/YYYY/YYYY-MM-DD.md と画像をコミット
```

- 鍵もデータも **あなたの端末とあなたのリポジトリにだけ** 置かれます。Vellum Labs のサーバは存在せず、通信先は Anthropic と GitHub だけです
- 日記の規約（常体・簡潔、充実度、支出テーブル、人物・店・場所・作品・自炊へのリンク）はアプリに組み込み済みです
- 統計（人物・店・支出の集計ページ）の更新は、リポジトリ側の Claude Code に任せます。同梱の [`skills/diary-ingest`](skills/diary-ingest/SKILL.md)（ai-diary 型）か [`skills/life-ingest`](skills/life-ingest/SKILL.md)（LLM Wiki Kit Pro の life log）を置くと `/diary-ingest`・`/life-ingest` で取り込めます

## 使い方

1. **ホーム画面に追加**: iOS Safari なら共有 → 「ホーム画面に追加」。Android Chrome なら「アプリをインストール」。普通のブラウザのタブでも動きます
2. **⚙ 設定** を開く
   - **Claude の API キー**: [Anthropic Console](https://console.anthropic.com/) で発行（`sk-ant-…`）。モデルは既定が `claude-opus-5-5`（精度重視）。安く済ませたいなら `claude-sonnet-5-5` か `claude-haiku-4-5`
   - **GitHub**（任意）: 日記リポジトリ（`owner/repo`）とブランチ、[Fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)。権限は **そのリポジトリ 1 つだけ** に対して `Contents: Read and write` で十分です。未設定なら `.md` と画像を端末に保存できます（スマホでは「共有・保存」で `.md` と写真を 1 回の共有シートにまとめて渡します。共有に非対応なブラウザでは 1 ファイルずつダウンロード）
   - **表示言語**: 既定はブラウザに合わせて日本語か英語。⚙ の「表示言語 / Language」で固定できます（日記の言語は「リポジトリの形式」で決まり、表示言語とは独立です）
   - **追加の指示**（任意）: 「猫の名前は『みけ』」「会社名は書かない」など
3. 日付を確認し、**🎙 話す**（ブラウザの音声認識。表示言語に合わせて日本語か英語）か、文章を書くか、**📷 撮る** でレシート・写真を付ける。充実度（0〜100）はスライダーで
4. **Claude で日記にする** → 確認画面で本文を直す（「要確認」が出た項目はここで確かめる）→ **GitHub にコミット**

同じ日に 2 回目を書くと、既存ファイルと統合して書き直します（支出行は残り、合計は再計算されます）。Kit 形式では既存の日記は変えず、`YYYY-MM-DD-2.md` として追加します。

## 日記リポジトリの形式

設定の「リポジトリの形式」で 2 つから選びます。既存のリポジトリに合わせたい場合は `prompt.js` の規約を書き換えてください。

| 形式 | 日記 | 既知の名前を読む場所 | 言語・通貨 | 同じ日の 2 回目 | 統計の更新 |
|---|---|---|---|---|---|
| **ai-diary 型**（既定） | `diary/YYYY/YYYY-MM-DD.md` | `stats/*/index.md` | 日本語・円 | 統合して書き直す | `skills/diary-ingest` |
| **LLM Wiki Kit Pro の life log** | `raw/diary/YYYY/YYYY-MM-DD.md` | `wiki/*/index.md`（slug と一行説明）、支出カテゴリは `wiki/finance/index.md` | 英語・ドル | `-2.md` を新規作成（raw は不変） | `skills/life-ingest` |

Kit 形式は [LLM Wiki Kit](https://github.com/vellumlabs/llm-wiki-kit) Pro 収録の life log wiki（`schema/life-log-workflow.md` の 1 日分の書式）に合わせています。レシート画像は `raw/receipts/images/`、写真は `raw/diary/YYYY/images/` に置き、ファイル名は ASCII の kebab-case です。日記の `Receipt:` 行は Kit の書式どおり転記ファイル `raw/receipts/<同名>.md` を指し、取り込み時に Claude Code が画像から書き起こします（取り込み前は `life-check.py` が「receipt missing」と出します）。アプリは `raw/` だけを書き、`wiki/` の更新はリポジトリ側の Claude Code が `skills/life-ingest/SKILL.md` で行います（`wiki/log.md` に `[day]` 行の無い日記を取り込みます）。

以下は ai-diary 型の構成です。

```
diary/
  2026/
    2026-10-02.md          ← このアプリが書く
    images/2026-10-02-レシート-サイゼリヤ.jpg
stats/
  people/index.md          ← 既知の名前をここから読み取り、同じ表記でリンクします
  shops/index.md  places/index.md  media/index.md  activities/index.md  cooking/index.md
  finance/                 ← 支出カテゴリ（食費・外食・日用品・…）
```

生成される 1 日分の例:

```markdown
# 2026-10-02 (金)

充実度: 80/100

## 今日のまとめ
山田さんと新規案件の打ち合わせ。昼はサイゼリヤ。夜はカレーを自炊。

## 出来事
- 午前、山田さんと新規案件の打ち合わせ
- 昼にサイゼリヤでランチ

## 登場人物
- [山田さん](../../stats/people/山田さん.md) — 新規案件の打ち合わせ

## 支出
| 店 | 品目 | カテゴリ | 金額 |
|----|------|---------|------|
| [サイゼリヤ](../../stats/shops/サイゼリヤ.md) | ランチ | [外食](../../stats/finance/外食.md) | 980円 |

合計: 980円
```

コミットした本文の末尾には `<!-- life-log-app: pending-stats -->` の目印が付きます。リポジトリ側で `/diary-ingest` を実行すると、目印のある日記から統計ページを更新し、目印を消します（Kit 形式は raw を変えないため目印を付けません。`/life-ingest` は `wiki/log.md` に載っていない日記を拾います）。

### 統計の取り込み（Claude Code）

```
cp -r skills/diary-ingest  <日記リポジトリ>/.claude/skills/diary-ingest
cd <日記リポジトリ> && claude
> /diary-ingest
```

Kit 形式の場合は `skills/life-ingest` を `<life-log リポジトリ>/.claude/skills/life-ingest` に置き、`/life-ingest` を実行します。

## プライバシーと費用

- API キーと GitHub トークンはこの端末の `localStorage` にだけ保存されます。別の端末には同期されません
- 書きかけの文章・写真・確認待ちの日記は、この端末の IndexedDB に下書きとして残ります（アプリを閉じても消えません）。保存・コミットした時点か「下書きを消す」で削除されます
- 画像は端末内で長辺 1600px の JPEG に縮小してから Anthropic に送り、同じものをリポジトリにコミットします
- Claude に送る前にサーバを経由しません。送った内容は [Anthropic の API 利用規約](https://www.anthropic.com/legal/commercial-terms)に従って扱われます
- アプリは無料です。Claude の API 費用はあなたのキーに請求されます。目安は 1 日分（文章＋レシート 1 枚）で `claude-opus-5-5` なら数円〜十数円、`claude-haiku-4-5` ならその 1/4 程度です。送信前に「Claude で日記にする」の下へ、選んだモデル・文字数・写真の枚数から計算した概算（円とドル、1$=150円）を表示します。概算なので、同じ日のファイルに追記するときや考える量が多いときは上振れします
- 「これは秘密:」と前置きした部分は日記に書かれません（要確認欄にその旨だけ残ります）

## 対応環境

| 機能 | iOS Safari | Android Chrome | PC の Chrome / Edge | Firefox |
|---|---|---|---|---|
| 文章・画像・コミット | ✅ | ✅ | ✅ | ✅ |
| 音声入力（SpeechRecognition） | ✅ | ✅ | ✅ | ❌（文章で入力） |
| ホーム画面・オフラインの画面表示 | ✅ | ✅ | ✅ | — |

オフラインでも画面の表示と下書きの保持はできます。送信・コミットには通信が必要です。

## 開発

```
git clone https://github.com/vellumlabs/life-log && cd life-log
python3 -m http.server 8080
# http://localhost:8080/?mock=1  … Claude を呼ばずに確認画面まで通せます
```

ビルドはありません。`index.html` / `app.js` / `prompt.js`（規約と出力スキーマ）/ `style.css` / `sw.js` / `manifest.webmanifest` の 6 ファイルだけです。

## 開示

- **Code: AI (Claude Code)**。Vellum Labs は LLM が運営する小さなスタジオで、このアプリのコードと文章は Claude Code が書きました
- **Graphics・Sound: no generative AI**。アイコンは手書きの SVG 1 枚で、生成 AI の絵・音は使っていません
- 不具合・要望は [Issues](https://github.com/vellumlabs/life-log/issues) へ

## ライセンス

MIT © 2026 Vellum Labs
