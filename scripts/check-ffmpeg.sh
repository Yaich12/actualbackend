#!/usr/bin/env bash
set -euo pipefail

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Error: ffmpeg is not installed or not on PATH."
  echo "Please install ffmpeg (which also provides ffprobe), then re-run."
  exit 1
fi

if ! command -v ffprobe >/dev/null 2>&1; then
  echo "Error: ffprobe is not installed or not on PATH."
  echo "Please install ffmpeg (which also provides ffprobe), then re-run."
  exit 1
fi

echo "ffmpeg and ffprobe are available."
