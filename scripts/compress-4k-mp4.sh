#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET_WIDTH="${TARGET_WIDTH:-1920}"
CRF="${CRF:-28}"
PRESET="${PRESET:-slow}"

"$SCRIPT_DIR/check-ffmpeg.sh"

BACKUP_DIR="$ROOT_DIR/.video_backup"

total_saved=0
compressed_count=0

human_size() {
  awk -v bytes="$1" 'BEGIN{
    split("B KB MB GB TB", units, " ");
    size=bytes;
    for(i=1; i<5 && size>=1024; i++){size/=1024;}
    if(i==1){printf "%d%s", bytes, units[i];}
    else{printf "%.1f%s", size, units[i];}
  }'
}

compress_file() {
  local file="$1"
  local dims
  local width
  local height

  dims="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$file" || true)"
  if [[ -z "$dims" ]]; then
    echo "Skip (no video stream): $file"
    return 0
  fi

  width="${dims%x*}"
  height="${dims#*x}"

  if [[ -z "$width" || -z "$height" ]]; then
    echo "Skip (invalid dimensions): $file"
    return 0
  fi

  if (( width < 3840 && height < 2160 )); then
    echo "Skip (not 4K): $file"
    return 0
  fi

  local before_bytes
  before_bytes="$(stat -f%z "$file")"

  local rel_path
  rel_path="${file#$ROOT_DIR/}"
  local backup_path="$BACKUP_DIR/$rel_path"
  mkdir -p "$(dirname "$backup_path")"
  cp -p "$file" "$backup_path"

  local tmp_file
  tmp_file="$(mktemp "${file}.tmp.XXXXXX")"

  if ! ffmpeg -y -i "$file" -vf "scale=${TARGET_WIDTH}:-2" -c:v libx264 -preset "$PRESET" -crf "$CRF" -movflags +faststart -an "$tmp_file" >/dev/null 2>&1; then
    echo "Error compressing: $file"
    rm -f "$tmp_file"
    return 1
  fi

  mv "$tmp_file" "$file"

  local after_bytes
  after_bytes="$(stat -f%z "$file")"

  local saved
  saved=$((before_bytes - after_bytes))
  if (( saved < 0 )); then
    saved=0
  fi

  total_saved=$((total_saved + saved))
  compressed_count=$((compressed_count + 1))

  echo "Compressed: $file"
  echo "  Before: ${before_bytes} bytes ($(human_size "$before_bytes"))"
  echo "  After : ${after_bytes} bytes ($(human_size "$after_bytes"))"
}

declare -a SEARCH_DIRS=(
  "$ROOT_DIR/public"
  "$ROOT_DIR/src"
  "$ROOT_DIR/assets"
)

found_any=false

for dir in "${SEARCH_DIRS[@]}"; do
  if [[ -d "$dir" ]]; then
    found_any=true
    while IFS= read -r -d '' file; do
      compress_file "$file"
    done < <(find "$dir" -type f -name "*.mp4" -print0)
  fi
done

if [[ "$found_any" == false ]]; then
  echo "No target directories found (public/, src/, assets/)."
fi

echo "Summary:"
echo "  Compressed: $compressed_count"
echo "  Total saved: ${total_saved} bytes ($(human_size "$total_saved"))"
