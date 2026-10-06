# Life Log — 話す・撮る・書く、で日記を Git に残す

*by [Vellum Labs](https://github.com/vellumlabs)*

**スマホのホーム画面から開き、今日あったことを話すか書くか撮るかすると、Claude があなたの日記リポジトリの規約で Markdown にして GitHub にコミットします。サーバはありません。**

👉 **https://vellumlabs.github.io/life-log/**

```
あなたのスマホ ──(Claude API キー)──▶ Anthropic   … 文章・音声・レシート画像を日記 Markdown に
       │
       └──(GitHub トークン)──▶ あなたの日記リポジトリ   … diary/YYYY/YYYY-MM-DD.md と画像をコミット
```

- 鍵もデータも **あなたの端末とあなたのリポジトリにだけ** 置かれます。Vellum Labs のサーバは存在せず、通信先は Anthropic と GitHub だけです
- 日記の規約（常体・簡潔、充実度、支出テーブル、人物・店・場所・作品・自炊へのリンク）はアプリに組み込み済みです
- 統計（人物・店・支出の集計ページ）の更新は、リポジトリ側の Claude Code に任せます。同梱の [`skills/diary-ingest`](skills/diary-ingest/SKILL.md) を置くと `/diary-ingest` で取り込めます

## 使い方

1. **ホーム画面に追加**: iOS Safari なら共有 → 「ホーム画面に追加」。Android Chrome なら「アプリをインストール」。普通のブラウザのタブでも動きます
2. **⚙ 設定** を開く
   - **Claude の API キー**: [Anthropic Console](https://console.anthropic.com/) で発行（`sk-ant-…`）。モデルは既定が `claude-opus-5-5`（精度重視）。安く済ませたいなら `claude-sonnet-5-5` か `claude-haiku-4-5`
   - **GitHub**（任意）: 日記リポジトリ（`owner/repo`）とブランチ、[Fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)。権限は **そのリポジトリ 1 つだけ** に対して `Contents: Read and write` で十分です。未設定なら `.md` と画像を端末に保存できます
   - **追加の指示**（任意）: 「猫の名前は『みけ』」「会社名は書かない」など
3. 日付を確認し、**🎙 話す**（ブラウザの音声認識、日本語）か、文章を書くか、**📷 撮る** でレシート・写真を付ける。充実度（0〜100）はスライダーで
4. **Claude で日記にする** → 確認画面で本文を直す（「要確認」が出た項目はここで確かめる）→ **GitHub にコミット**

同じ日に 2 回目を書くと、既存ファイルと統合して書き直します（支出行は残り、合計は再計算されます）。

## 日記リポジトリの形式

このアプリは次の構成を前提にします（[LLM Wiki Kit](https://github.com/vellumlabs/llm-wiki-kit) Pro に収録している「人生の実績管理」wiki と同じ規約です。既存のリポジトリに合わせたい場合は `prompt.js` の規約を書き換えてください）。

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

コミットした本文の末尾には `<!-- life-log-app: pending-stats -->` の目印が付きます。リポジトリ側で `/diary-ingest` を実行すると、目印のある日記から統計ページを更新し、目印を消します。

### 統計の取り込み（Claude Code）

```
cp -r skills/diary-ingest  <日記リポジトリ>/.claude/skills/diary-ingest
cd <日記リポジトリ> && claude
> /diary-ingest
```

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
