// tests/unit/slack-users.test.ts — FR-SLACK-05 name lookup in the local directory.

import { describe, expect, it } from "vitest";

import { findLocalSlackUsers } from "../../backends/connectors/slack-users";

const at = "2026-10-24T10:00:00.000Z";

describe("findLocalSlackUsers", () => {
  it("matches names in users.json and DM peers in the entity store, case-insensitively", () => {
    const users = { U07OZAN: { displayName: "Ozan Yilmaz", synced_at: at } };
    const entities = {
      D200: { synced_at: at, stale_after: "1h", id: "D200", user: "U09ANA", dm_peer_name: "Ana Ozanne" },
      C001: { synced_at: at, stale_after: "1h", id: "C001", name: "ozan-team" },
    };
    expect(findLocalSlackUsers(users, entities, "OZAN")).toEqual([
      { id: "U07OZAN", displayName: "Ozan Yilmaz" },
      { id: "U09ANA", displayName: "Ana Ozanne" },
    ]);
  });

  it("returns only the exact name when one matches exactly", () => {
    const users = {
      U1: { displayName: "Ana", synced_at: at },
      U2: { displayName: "Ana García", synced_at: at },
    };
    expect(findLocalSlackUsers(users, {}, "ana")).toEqual([{ id: "U1", displayName: "Ana" }]);
  });
});
