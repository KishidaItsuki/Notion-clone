#!/usr/bin/env bash
# データベースのバックアップ
#
# - SQLite の .backup を使うので、アプリを止めずに安全にコピーできる（WAL の内容も含む）
# - コピー後に整合性チェックを行い、gzip で圧縮して保存する
# - KEEP_DAYS より古いバックアップは削除する
#
# 実行:    ./deploy/backup.sh
# 毎日実行: crontab -e で次の1行を追加（毎日 3:00）
#          0 3 * * * /srv/notion-clone/deploy/backup.sh >> /srv/backups/notion-clone/backup.log 2>&1
#
# 変更したい場合は環境変数で指定できる（例: KEEP_DAYS=30 ./deploy/backup.sh）
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
DB_PATH="${DB_PATH:-$APP_DIR/data/app.db}"
BACKUP_DIR="${BACKUP_DIR:-/srv/backups/notion-clone}"
KEEP_DAYS="${KEEP_DAYS:-14}"

if [[ ! -f "$DB_PATH" ]]; then
  echo "[backup] データベースが見つかりません: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$BACKUP_DIR/app-$STAMP.db"
# 同じ秒に2回実行しても上書きしないよう、名前が重なったら番号を付ける
n=1
while [[ -e "$TMP" || -e "$TMP.gz" ]]; do
  TMP="$BACKUP_DIR/app-$STAMP-$n.db"
  n=$((n + 1))
done
# 途中で失敗したら、圧縮前の一時ファイルを残さない
trap 'rm -f "$TMP"' EXIT

sqlite3 "$DB_PATH" ".backup '$TMP'"

RESULT="$(sqlite3 "$TMP" "PRAGMA integrity_check;")"
if [[ "$RESULT" != "ok" ]]; then
  echo "[backup] 整合性チェックに失敗しました: $RESULT" >&2
  exit 1
fi

gzip "$TMP"
chmod 600 "$TMP.gz"

find "$BACKUP_DIR" -name 'app-*.db.gz' -mtime +"$KEEP_DAYS" -delete

echo "[backup] $(date '+%F %T') 完了: $TMP.gz ($(du -h "$TMP.gz" | cut -f1))"
