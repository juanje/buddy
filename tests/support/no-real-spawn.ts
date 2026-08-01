// tests/support/no-real-spawn.ts — arm the background-process guard (NFR-TEST-02).
//
// Loaded by both runners: vitest via `setupFiles`, cucumber via its `import`
// glob over tests/support. With this set, spawnReflectChild throws instead of
// forking, so a missing `spawnReflect` injection fails the test that caused it
// instead of quietly leaving a detached process behind.
//
// The second guard is the same idea for the worker itself: `agent-worker.ts`
// starts one when imported, and a test that imports it to drive `main()` would
// otherwise launch a real worker against the developer's own `~/.buddy`.

import {
  FORBID_REAL_REFLECT_SPAWN_ENV,
  FORBID_WORKER_AUTOSTART_ENV,
} from "../../shared/defaults";

process.env[FORBID_REAL_REFLECT_SPAWN_ENV] = "1";
process.env[FORBID_WORKER_AUTOSTART_ENV] = "1";
