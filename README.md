# TeamNotes — チームで使える Notion 風ワークスペース

Next.js + SQLite で動く、セルフホスト型の Notion 類似アプリです。

## 機能

| 機能 | 内容 |
| --- | --- |
| ページ階層 | サイドバーのツリーで無制限に入れ子。ドラッグ＆ドロップで並べ替え・移動（上端/下端＝前後、中央＝子にする） |
| ブロックエディタ | 「/」コマンドで見出し・箇条書き・番号付き・ToDo・引用・トグル・コード・表・画像など（BlockNote・日本語UI） |
| データベース | テキスト / 数値 / セレクト / 日付 / チェックボックス / ユーザー / URL のプロパティ。列ヘッダーから名前・種類・選択肢・色の変更、並べ替え、絞り込み |
| カンバン | セレクト型プロパティでグループ化したボード。カードをドラッグしてステータス変更、列の追加 |
| 行ページ | データベースの各行は本文を持つページとして開ける |
| 検索 | ⌘K / Ctrl+K。タイトル＋本文の全文検索、該当箇所のスニペット表示 |
| お気に入り | ユーザーごとにサイドバー上部へピン留め |
| ゴミ箱 | 配下ページごと移動・復元・完全削除 |
| ログイン | Google アカウントでログイン。初めての人は「参加申請」になり、管理者が承認するまで利用できません |
| メンバー管理 | 管理者は承認・却下・利用停止・管理者権限の付与ができます（利用停止にすると即座にログアウト） |
| チーム共有 | 承認済みメンバー全員が同じワークスペースを共有。5秒ごとに他メンバーの変更を反映し、同時編集で上書きしそうな場合は警告を表示 |

## 必要なもの

- Node.js 20.9 以上（22 / 24 推奨）

## セットアップ

### 1. Google の OAuth クライアントを作成

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成（既存のものでも可）
2. 「API とサービス」→「OAuth 同意画面」を設定
   - ユーザーの種類は「外部」（Google Workspace の社内だけで使うなら「内部」も可）
   - 「外部」でテスト中のままだと、登録したテストユーザーしかログインできません。チームで使う場合は「アプリを公開」にしてください（openid / email / profile のみなので Google の審査は不要です）
3. 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
   - アプリケーションの種類: **ウェブ アプリケーション**
   - 承認済みのリダイレクト URI: `http://localhost:3000/api/auth/google/callback`
     （本番では `https://<あなたのドメイン>/api/auth/google/callback` も追加）
4. 表示された **クライアント ID** と **クライアント シークレット** を控える

### 2. アプリを起動

```bash
cd notion-clone
npm install
cp .env.example .env
```

`.env` を編集します。

| 項目 | 内容 |
| --- | --- |
| `AUTH_SECRET` | 長いランダム文字列（`openssl rand -base64 32` の出力など） |
| `APP_URL` | アプリのURL。ローカルは `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 手順1で控えた値 |
| `ADMIN_EMAILS` | 管理者の Gmail / Google アカウントのアドレス（カンマ区切りで複数可） |

```bash
npm run dev
```

http://localhost:3000 を開き、`ADMIN_EMAILS` のアカウントで「Googleでログイン」すると、承認なしで管理者としてログインできます。
データベースは `data/app.db` に自動作成されるため、マイグレーション作業は不要です。

### 3. メンバーを招待する

1. メンバーにURLを伝え、「Googleでログイン」してもらう（この時点で参加申請になります）
2. 管理者はサイドバーの「メンバー管理」（承認待ちの件数が赤く表示されます）で「承認」
3. メンバーがもう一度「Googleでログイン」すると利用開始

`ADMIN_EMAILS` に書いた管理者は画面から変更できません（`.env` を編集して再起動）。画面から管理者にした人は、ほかの管理者が解除できます。

## チームで使う（本番起動）

```bash
npm run build
npm start            # ポート変更は PORT=8080 npm start
```

- `APP_URL` を本番のURL（例: `https://notes.example.com`）にし、Google 側の「承認済みのリダイレクト URI」にも同じURL＋`/api/auth/google/callback` を追加してください。
- Google ログインは原則 HTTPS が必要です（`localhost` のみ例外）。リバースプロキシ（Caddy / nginx など）で HTTPS 化してください。
- バックアップは `data/` フォルダ（`app.db` と `-wal` / `-shm` ファイル）をコピーするだけです。

## 構成

```
src/
  app/
    (app)/            ログイン後の画面（サイドバー付きレイアウト）
      page.tsx        ホーム（最近更新したページ）
      p/[id]/         ページ・データベース・行ページ
      admin/          メンバー管理（管理者のみ）
    login/            Google ログイン画面
    api/              REST API（認証・管理・ページ・検索・お気に入り・ゴミ箱）
  components/
    Sidebar.tsx       ページツリー・お気に入り・DnD
    PageView.tsx      タイトル・アイコン・保存/競合処理
    Editor.tsx        BlockNote エディタ
    DatabaseView.tsx  テーブル / ボード
    PropertyInput.tsx プロパティのセル編集
    SearchModal.tsx / TrashModal.tsx
  lib/
    db/               SQLite (better-sqlite3 + Drizzle ORM) スキーマと自動テーブル作成
    session.ts        JWT セッション（jose）
    google.ts         Google OAuth（PKCE・state・nonce 検証）
    server.ts         API 共通処理
    client.ts         フロント用 API / SWR フック
  middleware.ts       未ログイン時のリダイレクト
```

ページ・データベース・行はすべて `pages` テーブルの1レコードで、`type`（page / database）と
`database_id`（行の場合）で区別しています。データベースのプロパティ定義と行の値は JSON で保存します。

## 今後の拡張アイデア

- Yjs + WebSocket によるリアルタイム共同編集（現在は5秒ポーリング＋競合警告）
- 画像の外部ストレージ保存（現在はページ内にデータURLで保存、3MBまで）
- ワークスペース複数化・ページ単位の権限設定
- PostgreSQL への移行（Drizzle の dialect を変更）
