// tests/support/no-real-spawn.ts — arm the background-process guard (NFR-TEST-02).
//
// Loaded by both runners: vitest via `setupFiles`, cucumber via its `import`
// glob over tests/support. With this set, spawnReflectChild throws instead of
// forking, so a missing `spawnReflect` injection fails the test that caused it
// instead of quietly leaving a detached process behind.

import { FORBID_REAL_REFLECT_SPAWN_ENV } from "../../shared/defaults";

process.env[FORBID_REAL_REFLECT_SPAWN_ENV] = "1";
