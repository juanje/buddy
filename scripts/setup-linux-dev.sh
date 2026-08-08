#!/usr/bin/env bash
# Setup Linux dev/build environment for Buddy (Tauri v2 + Pi worker).
#
# Installs system libraries (WebKitGTK 4.1, GTK3, …) and Rust if missing.
# Node.js >= 22 and git must already be on PATH — the wizard checks git at
# runtime, and CI uses Node 22.
#
# Usage:
#   bash scripts/setup-linux-dev.sh          # system deps + rustup (if needed)
#   bash scripts/setup-linux-dev.sh --verify # check only, no installs
#
# After setup:
#   npm install && npm run tauri dev         # dev (worker via tsx)
#   npm run build:worker && npm run tauri build   # release bundles

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERIFY_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --verify) VERIFY_ONLY=true ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

warn() { echo "⚠ $*" >&2; }
ok() { echo "✓ $*"; }
fail() { echo "✗ $*" >&2; exit 1; }

detect_distro() {
  if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    echo "${ID:-unknown}"
    return
  fi
  echo "unknown"
}

# Mirrors .github/workflows/release.yml (Ubuntu 22.04) and Tauri v2 docs.
FEDORA_PACKAGES=(
  @development-tools
  pkgconf-pkg-config
  curl wget file
  gcc gcc-c++ make
  gtk3-devel
  webkit2gtk4.1-devel
  libappindicator-gtk3-devel
  librsvg2-devel
  openssl-devel
  libsoup3-devel
  javascriptcoregtk4.1-devel
  patchelf
)

DEBIAN_PACKAGES=(
  build-essential
  pkg-config
  curl wget file
  libwebkit2gtk-4.1-dev
  libappindicator3-dev
  librsvg2-dev
  patchelf
  libgtk-3-dev
  libsoup-3.0-dev
  libjavascriptcoregtk-4.1-dev
  libssl-dev
  libfuse2
)

install_fedora() {
  need_cmd dnf || fail "dnf not found — are you on Fedora/RHEL?"
  if $VERIFY_ONLY; then return; fi
  echo "Installing Tauri system dependencies (dnf)…"
  sudo dnf install -y "${FEDORA_PACKAGES[@]}"
}

install_debian() {
  need_cmd apt-get || fail "apt-get not found — are you on Debian/Ubuntu?"
  if $VERIFY_ONLY; then return; fi
  echo "Installing Tauri system dependencies (apt)…"
  sudo apt-get update
  sudo apt-get install -y "${DEBIAN_PACKAGES[@]}"
}

install_rust() {
  if need_cmd cargo && need_cmd rustc; then
    ok "Rust already installed: $(rustc --version)"
    return
  fi
  if $VERIFY_ONLY; then
    warn "Rust/Cargo not installed — run without --verify to install via rustup"
    return
  fi
  echo "Installing Rust via rustup…"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
  ok "Rust installed: $(rustc --version)"
}

verify_node() {
  if ! need_cmd node; then
    fail "Node.js not found. Buddy requires Node >= 22 (see README.md)."
  fi
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$major" -lt 22 ]]; then
    fail "Node.js $(node -v) is too old — need >= 22"
  fi
  ok "Node.js $(node -v)"
}

verify_git() {
  if ! need_cmd git; then
    fail "git not found — Buddy uses git for the user's memory repo."
  fi
  ok "git $(git --version | awk '{print $3}')"
}

verify_webkit() {
  if need_cmd pkg-config && pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
    ok "webkit2gtk-4.1 $(pkg-config --modversion webkit2gtk-4.1)"
    return
  fi
  fail "webkit2gtk-4.1 not found — run this script without --verify to install system deps"
}

verify_rust() {
  if need_cmd cargo; then
    ok "cargo $(cargo --version | awk '{print $2}')"
    return
  fi
  fail "cargo not found — run this script without --verify to install Rust"
}

main() {
  echo "Buddy Linux dev setup (repo: $ROOT)"
  echo

  verify_node
  verify_git

  local distro
  distro="$(detect_distro)"
  echo "Detected distro: $distro"
  echo

  case "$distro" in
    fedora|rhel|centos|rocky|almalinux)
      install_fedora
      ;;
    debian|ubuntu|linuxmint|pop)
      install_debian
      ;;
    *)
      warn "Unknown distro '$distro' — install Tauri v2 Linux deps manually:"
      echo "  https://v2.tauri.app/start/prerequisites/"
      echo "  Fedora: dnf install webkit2gtk4.1-devel gtk3-devel …"
      echo "  Debian: apt install libwebkit2gtk-4.1-dev libgtk-3-dev …"
      if ! $VERIFY_ONLY; then
        read -r -p "Continue with Rust install only? [y/N] " ans
        [[ "${ans,,}" == "y" ]] || exit 1
      fi
      ;;
  esac

  install_rust

  # rustup adds cargo to ~/.cargo/env — load for verify in this shell
  if [[ -f "$HOME/.cargo/env" ]]; then
    # shellcheck source=/dev/null
    source "$HOME/.cargo/env"
  fi

  echo
  echo "Verifying toolchain…"
  verify_webkit
  verify_rust

  if ! $VERIFY_ONLY && [[ -f "$ROOT/scripts/ensure-sidecar.sh" ]]; then
    echo
    echo "Building worker sidecar (required by Tauri externalBin)…"
    bash "$ROOT/scripts/ensure-sidecar.sh"
  fi

  if $VERIFY_ONLY; then
    echo
    ok "Verification passed"
    exit 0
  fi

  echo
  echo "Next steps:"
  echo "  cd $ROOT"
  echo "  npm install"
  echo "  npm run build:worker     # once — Tauri requires the sidecar file even in dev"
  echo "  npm run tauri dev"
  echo "  npm run tauri build      # release .deb / .rpm (build:worker runs via npm run build)"
  echo
  if [[ -f "$HOME/.cargo/env" ]] && ! grep -q '.cargo/env' "$HOME/.bashrc" 2>/dev/null; then
    echo "Add Rust to future shells:"
    echo '  echo '\''source "$HOME/.cargo/env"'\'' >> ~/.bashrc'
  fi
}

main "$@"
