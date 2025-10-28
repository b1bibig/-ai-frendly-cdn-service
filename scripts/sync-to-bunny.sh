#!/usr/bin/env bash
set -euo pipefail

if ! command -v rclone >/dev/null 2>&1; then
  cat <<'MSG' >&2
Error: rclone is not installed.
Install it from https://rclone.org/install/ or via your package manager, then rerun this script.
MSG
  exit 1
fi

: "${BUNNY_STORAGE_NAME:?Environment variable BUNNY_STORAGE_NAME must be set (your Bunny Storage zone name).}"
: "${BUNNY_ACCESS_KEY:?Environment variable BUNNY_ACCESS_KEY must be set (your Bunny Storage access key).}"
BUNNY_STORAGE_ENDPOINT="${BUNNY_STORAGE_ENDPOINT:-https://storage.bunnycdn.com}"

CONFIG_DIR="$(mktemp -d)"
trap 'rm -rf "$CONFIG_DIR"' EXIT

cat >"${CONFIG_DIR}/rclone.conf" <<EOF_CONF
[bunny]
type = s3
provider = Other
env_auth = false
access_key_id =
secret_access_key = ${BUNNY_ACCESS_KEY}
endpoint = ${BUNNY_STORAGE_ENDPOINT}
region = auto
no_check_bucket = true
EOF_CONF

RCLONE_CONFIG="${CONFIG_DIR}/rclone.conf" rclone sync ./users "bunny:${BUNNY_STORAGE_NAME}/users" \
  --progress --copy-links --transfers=8 --checkers=8 --metadata \
  --s3-upload-concurrency=8 \
  --header-upload "Cache-Control: public, max-age=31536000, immutable"
