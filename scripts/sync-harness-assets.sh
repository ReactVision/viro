#!/bin/bash
#
# Copy the two WASM modules the web harness needs into place.
#
# Both live under gitignored directories, because they are build outputs of
# sibling repos rather than sources of this one. That is the right call and it
# had a cost: nothing recorded which build was in use, so the harness ran a
# tracking engine 18 days older than the tree it was being tested against, and
# the only way to notice was to compare binaries by hand.
#
#   web-harness/wasm/    <- viro-web.{js,wasm,data}   from viro-web-renderer
#   web-harness/public/  <- tinyvio-slam.{js,wasm}    from tinyvio
#
# Override either source with VIRO_WEB_RENDERER=/path or TINYVIO=/path.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RENDERER="${VIRO_WEB_RENDERER:-$ROOT/../viro-web-renderer}"
TINYVIO="${TINYVIO:-$ROOT/../tinyvio}"

WASM_DIR="$ROOT/web-harness/wasm"
PUBLIC_DIR="$ROOT/web-harness/public"
mkdir -p "$WASM_DIR" "$PUBLIC_DIR"

fail=0

# $1 source file, $2 destination directory, $3 how to rebuild it
copy_or_warn() {
  local src="$1" dest="$2" hint="$3"
  local name; name="$(basename "$src")"
  if [ -f "$src" ]; then
    cp "$src" "$dest/"
    printf '  %-22s %8s bytes  %s\n' "$name" "$(wc -c <"$src" | tr -d ' ')" "$(date -r "$src" '+%Y-%m-%d %H:%M')"
  elif [ -f "$dest/$name" ]; then
    # Keeping a stale copy beats deleting the only one there is, but say so --
    # silently running yesterday's engine is the failure this script exists for.
    printf '  %-22s NOT FOUND at source, keeping the existing copy\n' "$name"
    echo "      build it with: $hint"
    fail=1
  else
    printf '  %-22s MISSING, and there is no copy to fall back on\n' "$name"
    echo "      build it with: $hint"
    fail=2
  fi
}

echo "renderer  <- $RENDERER/wasm"
for f in viro-web.js viro-web.wasm viro-web.data; do
  copy_or_warn "$RENDERER/wasm/$f" "$WASM_DIR" \
    "cd ../virocore/wasm && ./build_web.sh && cd ../../viro-web-renderer && npm run copy-wasm"
done

echo "tracking  <- $TINYVIO/web/slam"
for f in tinyvio-slam.js tinyvio-slam.wasm; do
  copy_or_warn "$TINYVIO/web/slam/$f" "$PUBLIC_DIR" \
    "cd ../tinyvio && source \"\$EMSDK/emsdk_env.sh\" && ./scripts/build_slam_wasm.sh"
done

if [ "$fail" -eq 2 ]; then
  echo
  echo "ERROR: the harness cannot run without these. Build them and re-run."
  exit 1
fi

if [ "$fail" -eq 1 ]; then
  echo
  echo "WARNING: ran with at least one stale copy. Rebuild before trusting a result."
fi
