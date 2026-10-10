// tests/unit/dashboard-field-labels.test.ts — FR-DASH-10

import { describe, expect, it } from "vitest";

import {
  displayFieldValue,
  humanizeFieldLabel,
  overdueLabel,
  viewLabel,
} from "../../src/lib/dashboard/field-labels";

describe("humanizeFieldLabel", () => {
  it("localizes tasks source fields in Spanish", () => {
    expect(humanizeFieldLabel("text", "tasks", "es")).toBe("Tarea");
    expect(humanizeFieldLabel("due", "tasks", "es")).toBe("Vence");
  });

  it("capitalizes inline field names", () => {
    expect(humanizeFieldLabel("paso", "inline", "es")).toBe("Paso");
  });
});

describe("displayFieldValue", () => {
  it("prefixes tasks area and project like tasks.md", () => {
    expect(displayFieldValue("area", "work", "tasks")).toBe("@work");
    expect(displayFieldValue("project", "alpha", "tasks")).toBe("#alpha");
  });

  it("leaves other sources and fields unchanged", () => {
    expect(displayFieldValue("area", "work", "inline")).toBe("work");
    expect(displayFieldValue("text", "hello", "tasks")).toBe("hello");
  });

  it("returns empty for blank values", () => {
    expect(displayFieldValue("area", "  ", "tasks")).toBe("");
  });
});

describe("viewLabel", () => {
  it("localizes view names for error cards", () => {
    expect(viewLabel("counter", "es")).toBe("Contador");
    expect(viewLabel("counter", "en")).toBe("Counter");
  });
});

describe("overdueLabel", () => {
  it("uses singular phrasing for one day", () => {
    expect(overdueLabel(1, "en")).toBe("overdue by 1 day");
    expect(overdueLabel(1, "es")).toBe("vencida hace 1 día");
  });
});
