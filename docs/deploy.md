# 本番サーバーへのデプロイ手順

VPS（さくらの VPS、ConoHa VPS、Xserver VPS、AWS Lightsail など）に Ubuntu を入れて、TeamNotes を動かす手順です。

この手順書では、次の値を例として使います。実際の値に読み替えてください。

| 項目 | 例 |
| --- | --- |
| サーバーの IP アドレス | `203.0.113.10` |
| 公開するドメイン | `notes.example.com` |
| 作業用ユーザー | `deploy` |
| アプリの置き場所 | `/srv/notion-clone` |
| バックアップの置き場所 | `/srv/backups/notion-clone` |

## 全体の構成

```
ブラウザ ──HTTPS(443)──▶ Caddy ──▶ Next.js（127.0.0.1:3000） ──▶ data/app.db（SQLite）
                         証明書は自動     systemd が常駐・自動起動      毎日バックアップ
```

- 外部に開けるポートは 22（SSH）、80、443 だけです。アプリの 3000 番は外部に開けません。
- アプリとデータベースは同じサーバーに置きます。サーバーは 1 台で動かしてください（SQLite のファイルを複数のサーバーで共有しないこと）。

## 事前に用意するもの

- [ ] VPS：Ubuntu 24.04 LTS、**メモリ 2GB 以上**（1GB ではビルド時にメモリが足りないことがあります）
- [ ] ドメイン：DNS に A レコードを追加し、サーバーの IP アドレスを指定
  ```
  notes.example.com.   A   203.0.113.10
  ```
- [ ] GitHub のリポジトリ（main ブランチにデプロイする内容が入っていること）
- [ ] Google Cloud Console の OAuth クライアント（ローカルで使っているものと同じでよい）

DNS の反映には数分〜数時間かかります。`dig +short notes.example.com` でサーバーの IP アドレスが返ってくれば反映済みです。

---

## 1. サーバーの初期設定

`root` で接続して、作業用ユーザーを作ります。

```bash
ssh root@203.0.113.10

adduser deploy
usermod -aG sudo deploy
```

Mac から、SSH の鍵を登録します（Mac 側で実行）。

```bash
ssh-copy-id deploy@203.0.113.10
ssh deploy@203.0.113.10        # パスワードなしでログインできることを確認
```

鍵でログインできることを確認したら、パスワードと root でのログインを禁止します。

```bash
sudo nano /etc/ssh/sshd_config
#   PasswordAuthentication no
#   PermitRootLogin no
sudo systemctl restart ssh
```

> 設定を変えた後は、**今の接続を閉じる前に**別のターミナルから `ssh deploy@...` でログインできることを確認してください。閉め出されるのを防ぐためです。

ファイアウォールと OS の更新です。

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

sudo apt update && sudo apt upgrade -y
sudo apt install -y unattended-upgrades     # セキュリティ更新を自動で適用
```

## 2. 必要なソフトのインストール

```bash
# ビルドツール（better-sqlite3 のコンパイルが必要な場合に使用）、git、sqlite3（バックアップで使用）
sudo apt install -y build-essential python3 git sqlite3 curl

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v                                   # v22.x.x

# Caddy（HTTPS 対応の Web サーバー）
sudo apt install -y caddy
```

> `apt install caddy` で見つからない場合は、Caddy 公式サイトの「Install」→「Debian, Ubuntu」の手順で、Caddy のリポジトリを追加してからインストールしてください。

## 3. アプリの設置

```bash
sudo mkdir -p /srv/notion-clone /srv/backups/notion-clone
sudo chown deploy:deploy /srv/notion-clone /srv/backups/notion-clone

cd /srv/notion-clone
git clone https://github.com/<アカウント>/Notion-clone.git .
```

> 非公開のリポジトリの場合は、サーバーで SSH 鍵を作って GitHub の「Deploy keys」（読み取り専用）に登録し、`git@github.com:...` の URL で clone してください。

`.env` をサーバー上で作ります。**Git には上げません。**

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

| 項目 | 本番での値 |
| --- | --- |
| `DATABASE_PATH` | `"./data/app.db"`（そのままでよい） |
| `AUTH_SECRET` | `openssl rand -base64 32` で**新しく作る**（ローカルと同じ値にしない） |
| `APP_URL` | `"https://notes.example.com"`（末尾の `/` は付けない） |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console の値 |
| `ADMIN_EMAILS` | 管理者のメールアドレス |
| `PRIVACY_OPERATOR_NAME` など | プライバシーポリシーに表示する運営者名・連絡先・制定日 |

インストールとビルドです。

```bash
npm ci
npm run build
chmod +x deploy/*.sh
```

### 手元のデータを引き継ぐ場合

Mac で `npm run dev` を止めてから、`data/` フォルダをサーバーにコピーします（Mac 側で実行）。

```bash
scp -r ~/Documents/Buzz関連/Notion-clone/data deploy@203.0.113.10:/srv/notion-clone/
```

新しく空の状態から始める場合は不要です。初回のアクセス時にテーブルが自動で作られます。

## 4. 自動起動の設定（systemd）

```bash
sudo cp deploy/notion-clone.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now notion-clone

sudo systemctl status notion-clone        # active (running) ならOK
curl -I http://127.0.0.1:3000/login       # HTTP/1.1 200 が返ればOK
```

ログは次のコマンドで見られます。

```bash
journalctl -u notion-clone -f
```

## 5. HTTPS の設定（Caddy）

`deploy/Caddyfile` の 1 行目のドメインを書き換えてから設置します。

```bash
nano deploy/Caddyfile                     # notes.example.com を本番のドメインに
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

ブラウザで `https://notes.example.com` を開き、鍵マーク付きでログイン画面が表示されれば成功です。証明書の取得に失敗する場合は、`journalctl -u caddy -n 50` でログを確認してください（DNS が未反映、80 番ポートが閉じている、などが主な原因です）。

## 6. Google 側の設定

Google Cloud Console（Google Auth Platform）で設定します。

| 画面 | 設定 |
| --- | --- |
| クライアント → 承認済みのリダイレクト URI | `https://notes.example.com/api/auth/google/callback` を**追加**（localhost の URI は残してよい） |
| ブランディング | ホームページ：`https://notes.example.com`<br>プライバシーポリシー：`https://notes.example.com/privacy`<br>承認済みドメイン：`example.com` |
| 対象（オーディエンス） | 会社の Google Workspace だけで使う → 「内部」<br>個人の Gmail も使う → 「外部」にして「アプリを公開」 |

- ロゴはアップロードしないでください（Google の審査が必要になります）。
- 承認済みドメインの登録時に、Google Search Console でドメインの所有確認を求められることがあります。

## 7. 動作確認

- [ ] `https://notes.example.com` が鍵マーク付きで開ける
- [ ] `http://notes.example.com` にアクセスすると https に転送される
- [ ] `ADMIN_EMAILS` のアカウントで Google ログインできる
- [ ] 別のアカウントでログインすると「承認待ち」になり、メンバー管理で承認するとログインできる
- [ ] ページの作成・編集・検索・ゴミ箱が使える
- [ ] `https://notes.example.com/privacy` がログインなしで表示される
- [ ] `sudo reboot` の後も自動で起動する

## 8. バックアップの自動化

まず手動で実行して、動くことを確認します。

```bash
./deploy/backup.sh
ls -lh /srv/backups/notion-clone/
```

毎日 3:00 に実行するよう登録します。

```bash
crontab -e
```

```
0 3 * * * /srv/notion-clone/deploy/backup.sh >> /srv/backups/notion-clone/backup.log 2>&1
```

- 保存期間は 14 日です（`KEEP_DAYS` で変更できます）。
- サーバー自体の故障に備えて、バックアップは**別の場所にもコピー**しておくことをおすすめします（Mac に定期的に `scp` で取得する、AWS S3 に送る、VPS のバックアップ機能を使う、など）。

---

## 更新（デプロイ）の手順

main ブランチに変更を取り込んだら、サーバーで次を実行します。

```bash
cd /srv/notion-clone
./deploy/update.sh
```

`update.sh` は、バックアップ → `git pull`（main）→ `npm ci` → `npm run build` → 再起動 → 起動確認 を順番に行います。データベースのマイグレーション（`drizzle/` に追加された SQL）は、再起動後の最初のアクセスで自動的に適用されます。

## 困ったとき

| 症状 | 確認すること |
| --- | --- |
| サイトが開けない | `sudo systemctl status notion-clone`、`sudo systemctl status caddy`、`journalctl -u notion-clone -n 100` |
| 「redirect_uri_mismatch」 | Google 側のリダイレクト URI と `.env` の `APP_URL` が一致しているか（https、末尾の `/` なし） |
| ログインしてもすぐログイン画面に戻る | `.env` の `APP_URL` が https になっているか。変更したら `sudo systemctl restart notion-clone` |
| 起動時に「AUTH_SECRET を…変更してください」 | `.env` の `AUTH_SECRET` が初期値のまま、または 16 文字未満 |
| `npm run build` が途中で止まる | メモリ不足。2GB 以上のプランにするか、スワップを追加する |

### バックアップから戻す

```bash
sudo systemctl stop notion-clone
cd /srv/notion-clone
mkdir -p data/broken && mv data/app.db* data/broken/                     # 今の DB を退避
gunzip -c /srv/backups/notion-clone/app-YYYYMMDD-HHMMSS.db.gz > data/app.db
sudo systemctl start notion-clone
```

### 更新前のバージョンに戻す

```bash
sudo systemctl stop notion-clone
git log --oneline -5                       # 戻したいコミットを確認
git checkout <コミットID>
npm ci && npm run build
sudo systemctl start notion-clone
```

> マイグレーションでテーブルを変更した更新を戻す場合は、コードだけでなく、データベースも更新前のバックアップに戻してください。元に戻したら `git checkout main` で main に戻し、問題を修正してから改めて `./deploy/update.sh` を実行します。
