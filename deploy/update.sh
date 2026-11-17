#!/usr/bin/env bash
# 本番サーバーの更新（デプロイ）
#
# 1. 更新前にデータベースをバックアップ
# 2. GitHub から最新のコードを取得（既定は main ブランチ）
# 3. 依存パッケージのインストールとビルド
# 4. アプリを再起動（マイグレーションは再起動後に自動適用される）
# 5. 起動したか確認
#
# 実行: ./deploy/update.sh
# 別のブランチを使う場合: BRANCH=develop ./deploy/update.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-notion-clone}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/login}"

cd "$APP_DIR"

echo "==> 1/5 バックアップ"
if [[ -f data/app.db ]]; then
  "$APP_DIR/deploy/backup.sh"
else
  echo "    データベースがまだ無いため省略"
fi

echo "==> 2/5 最新のコードを取得（$BRANCH）"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "    サーバー上でファイルが変更されています。内容を確認してから再実行してください:" >&2
  git status --short >&2
  exit 1
fi
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git merge --ff-only "origin/$BRANCH"
echo "    現在のコミット: $(git log -1 --format='%h %s')"

echo "==> 3/5 インストールとビルド"
npm ci
npm run build

echo "==> 4/5 再起動"
sudo systemctl restart "$SERVICE"

echo "==> 5/5 起動確認"
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "$HEALTH_URL"; then
    echo "    起動しました"
    exit 0
  fi
  sleep 1
done
echo "    30秒以内に応答がありませんでした。ログを確認してください: journalctl -u $SERVICE -n 100" >&2
exit 1
