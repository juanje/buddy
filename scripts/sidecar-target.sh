#!/usr/bin/env bash
# Shared: compute Rust host target triple for sidecar naming.
SIDECAR_TARGET="$(rustc -vV | grep host | cut -d' ' -f2)"
