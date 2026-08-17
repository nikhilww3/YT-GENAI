#!/usr/bin/env bash
# Downloads the Tectonic LaTeX engine binary (used by resume.service.js to
# compile the tailored-resume feature's LaTeX to PDF) into Backend/bin/tectonic.
# No system-wide install, no Homebrew/apt, no Docker — just one static binary.
set -euo pipefail

TECTONIC_VERSION="0.17.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/../bin"
DEST="$BIN_DIR/tectonic"

if [ -x "$DEST" ]; then
  echo "tectonic already installed at $DEST ($("$DEST" --version))"
  exit 0
fi

os="$(uname -s)"
arch="$(uname -m)"

case "$os-$arch" in
  Darwin-arm64)  target="aarch64-apple-darwin" ;;
  Darwin-x86_64) target="x86_64-apple-darwin" ;;
  Linux-x86_64)  target="x86_64-unknown-linux-gnu" ;;
  Linux-aarch64) target="aarch64-unknown-linux-musl" ;;
  *)
    echo "No known Tectonic build for $os-$arch." >&2
    echo "See https://github.com/tectonic-typesetting/tectonic/releases and set TECTONIC_PATH manually." >&2
    exit 1
    ;;
esac

url="https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${target}.tar.gz"

mkdir -p "$BIN_DIR"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "Downloading tectonic ${TECTONIC_VERSION} for ${target}..."
curl -sL "$url" -o "$tmp_dir/tectonic.tar.gz"
tar -xzf "$tmp_dir/tectonic.tar.gz" -C "$tmp_dir"
mv "$tmp_dir/tectonic" "$DEST"
chmod +x "$DEST"

echo "Installed: $("$DEST" --version)"
echo "Set TECTONIC_PATH=$DEST in Backend/.env if it isn't picked up automatically."
