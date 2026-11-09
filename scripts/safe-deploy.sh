#!/usr/bin/env bash
# Sync approved Structure Planner frontend files to the live Bluehost folder.
# Never overwrites config.js or .env files. It does update .htaccess from the source.
# Default is a dry run. Pass --live to actually copy.
#
# Run this on Bluehost (SSH or cPanel Terminal), not from a Windows checkout
# unless you change the paths. The live folder is the website_98d9e671 planner,
# not public_html/planner.
set -euo pipefail

WORK_DIR="/home2/conniew7/planner-work"
LIVE_DIR="/home2/conniew7/public_html/website_98d9e671/planner"
BACKUP_DIR="/home2/conniew7/.config-backups"

usage() {
  echo "Usage: $0 [--live] [SOURCE_DIR]"
  echo "  Default: dry-run from frontend/live-build (or live-build) under $WORK_DIR"
  echo "  Live planner path: $LIVE_DIR"
  exit 2
}

LIVE=0
SOURCE_DIR=""
for arg in "$@"; do
  case "$arg" in
    --live) LIVE=1 ;;
    -h|--help) usage ;;
    --*) echo "Unknown flag: $arg"; usage ;;
    *) SOURCE_DIR="$arg" ;;
  esac
done

if [[ -z "$SOURCE_DIR" ]]; then
  if [[ -f "$WORK_DIR/frontend/live-build/index.html" ]]; then
    SOURCE_DIR="$WORK_DIR/frontend/live-build"
  elif [[ -f "$WORK_DIR/live-build/index.html" ]]; then
    SOURCE_DIR="$WORK_DIR/live-build"
  elif [[ -f "$WORK_DIR/index.html" ]]; then
    SOURCE_DIR="$WORK_DIR"
  else
    echo "ABORT: No source index.html found. Put the live-build files in"
    echo "  $WORK_DIR/frontend/live-build  or  $WORK_DIR/live-build"
    echo "or pass the source directory as an argument."
    exit 1
  fi
fi

if [[ ! -f "$SOURCE_DIR/index.html" ]]; then
  echo "ABORT: $SOURCE_DIR/index.html is missing."
  exit 1
fi

if [[ ! -d "$LIVE_DIR" || ! -f "$LIVE_DIR/index.html" ]]; then
  echo "ABORT: Live planner folder not found at:"
  echo "  $LIVE_DIR"
  echo "Refusing to create or sync a new path. Check docs/DEPLOY.md."
  exit 1
fi

git_dir=""
if git -C "$SOURCE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_dir="$SOURCE_DIR"
elif git -C "$WORK_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_dir="$WORK_DIR"
fi
if [[ -n "$git_dir" ]]; then
  branch=$(git -C "$git_dir" rev-parse --abbrev-ref HEAD)
  if [[ "$branch" == "main" ]]; then
    echo "ABORT: Git branch in $git_dir is 'main'. Switch to feature/static-azure-api or feature/welding-plans."
    exit 1
  fi
fi

mkdir -p "$BACKUP_DIR"
if [[ ! -f "$LIVE_DIR/config.js" ]]; then
  echo "ABORT: No config.js at $LIVE_DIR/config.js. Refusing to deploy to a folder that is not the live planner."
  exit 1
fi

STAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/config.js.bak.$STAMP"
cp -p "$LIVE_DIR/config.js" "$BACKUP_FILE"
echo "Backed up live config.js -> $BACKUP_FILE"

RSYNC_FLAGS=(-av)
if [[ "$LIVE" -eq 0 ]]; then
  RSYNC_FLAGS+=(--dry-run)
  echo "DRY RUN only (pass --live to copy)."
else
  echo "LIVE SYNC."
fi
echo "Source: $SOURCE_DIR"
echo "Destination: $LIVE_DIR"

# Allowlist only frontend files. Never copy config.js or config.example.js.
# --delete is intentionally omitted so untracked live files stay put.
rsync "${RSYNC_FLAGS[@]}" \
  --exclude='config.js' \
  --exclude='**/config.js' \
  --exclude='config.example.js' \
  --exclude='.env*' \
  --exclude='README.md' \
  --exclude='*.zip' \
  --include='index.html' \
  --include='favicon.svg' \
  --include='manifest.webmanifest' \
  --include='sw.js' \
  --include='.htaccess' \
  --include='assets/' \
  --include='assets/***' \
  --exclude='*' \
  "$SOURCE_DIR/" "$LIVE_DIR/"

if ! cmp -s "$LIVE_DIR/config.js" "$BACKUP_FILE"; then
  echo "ABORT: config.js changed during sync; restoring from backup."
  cp -p "$BACKUP_FILE" "$LIVE_DIR/config.js"
  exit 1
fi
echo "VERIFIED: $LIVE_DIR/config.js is unchanged."

if [[ "$LIVE" -eq 0 ]]; then
  echo "Dry run finished. Re-run with --live to apply."
fi
