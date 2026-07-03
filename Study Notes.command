#!/bin/bash
# Double-click to launch the Study Notes app, then open it in the browser.
# NOTE: the desktop app (dist-app/mac-arm64/Study Notes.app) is now the main
# way to run this. This script remains as a browser fallback — both read and
# write the SAME data folder in ~/Library/Application Support/Study Notes.
cd "$(dirname "$0")" || exit 1

export STUDY_NOTES_DATA_DIR="$HOME/Library/Application Support/Study Notes/data"

# Build once if there's no production build yet.
if [ ! -d ".next" ]; then
  echo "First run — building…"
  npm install --no-audit --no-fund
  npm run build
fi

# Start the server in the background, wait for it, open the browser.
npm run start >/tmp/study-notes.log 2>&1 &
SERVER_PID=$!

echo "Starting Study Notes (pid $SERVER_PID)…"
for i in {1..30}; do
  if curl -s http://localhost:3000 >/dev/null 2>&1; then break; fi
  sleep 0.5
done

open http://localhost:3000
echo "Open at http://localhost:3000 — close this window to stop the app."
wait $SERVER_PID
