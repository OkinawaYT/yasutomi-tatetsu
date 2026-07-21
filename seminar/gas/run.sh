#!/bin/bash

# Seminar GAS - Deployment Helper

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

build() {
  echo "Building..."
  rm -rf dist
  bunx tsc -p tsconfig.json && cp src/appsscript.json dist/
  echo "Build complete."
}

require_valid_clasp_config() {
  if [[ ! -f .clasp.json ]]; then
    echo "Error: .clasp.json not found in $(pwd)"
    echo "Run: bunx clasp create --type standalone --title \"Seminar GAS\" --rootDir dist"
    return 1
  fi

  script_id="$(sed -n 's/.*"scriptId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' .clasp.json | head -n 1)"
  if [[ -z "$script_id" || "$script_id" == "YOUR_SCRIPT_ID" ]]; then
    echo "Error: Invalid scriptId in .clasp.json"
    echo "Set a valid Apps Script project ID, for example:"
    echo "  bunx clasp clone <SCRIPT_ID> --rootDir dist"
    echo "or edit .clasp.json and replace YOUR_SCRIPT_ID."
    return 1
  fi
}

echo "--------------------------------------------------"
echo "  Seminar GAS - Deployment Menu"
echo "--------------------------------------------------"
echo "    1) Build"
echo "    2) Deploy (Build + Push)"
echo "    3) Pull (Download from GAS)"
echo "    4) Open GAS Editor"
echo "    q) Quit"
echo "--------------------------------------------------"
read -p "Select an option: " choice

case $choice in
    1) build ;;
  2) echo "Deploying..."; require_valid_clasp_config && build && bunx clasp push --force ;;
  3) echo "Pulling..."; require_valid_clasp_config && bunx clasp pull ;;
  4) require_valid_clasp_config && bunx clasp open ;;
    q) echo "Exiting."; exit 0 ;;
    *) echo "Invalid option."; exit 1 ;;
esac
