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
    2) echo "Deploying..."; build && bunx clasp push --force ;;
    3) echo "Pulling..."; bunx clasp pull ;;
    4) bunx clasp open ;;
    q) echo "Exiting."; exit 0 ;;
    *) echo "Invalid option."; exit 1 ;;
esac
