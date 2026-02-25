import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDatabase, closeDatabase } from "../db/database.js";
import { listCriteria, addCriterion, deleteCriterion, updateCriterion } from "./criteriaService.js";

beforeEach(() => {
  openDatabase(":memory:");
});

afterEach(() => {
  closeDatabase();
});

describe("addCriterion / listCriteria", () => {
  it("adds a criterion with defaults", () => {
    const c = addCriterion({ name: "Relevance" });
    expect(c.id).toBeTruthy();
    expect(c.name).toBe("Relevance");
    expect(c.maxScore).toBe(10);
    expect(c.weight).toBe(1);
  });

  it("adds a criterion with custom maxScore and weight", () => {
    const c = addCriterion({ name: "Grammar", maxScore: 5, weight: 2 });
    expect(c.maxScore).toBe(5);
    expect(c.weight).toBe(2);
  });

  it("listCriteria returns all criteria", () => {
    addCriterion({ name: "A" });
    addCriterion({ name: "B" });
    expect(listCriteria()).toHaveLength(2);
  });
});

describe("deleteCriterion", () => {
  it("removes the criterion", () => {
    const c = addCriterion({ name: "Temp" });
    expect(deleteCriterion(c.id)).toBe(true);
    expect(listCriteria()).toHaveLength(0);
  });

  it("returns false for unknown id", () => {
    expect(deleteCriterion("no-such-id")).toBe(false);
  });
});

describe("updateCriterion", () => {
  it("updateCriterion — updates name and returns updated criterion", () => {
    const c = addCriterion({ name: "Original", maxScore: 10, weight: 1 });
    const updated = updateCriterion(c.id, { name: "Updated" });
    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("Updated");
    expect(updated?.maxScore).toBe(10);
    expect(updated?.weight).toBe(1);
  });

  it("updateCriterion — returns null for non-existent id", () => {
    const result = updateCriterion("no-such-id", { name: "Ghost" });
    expect(result).toBeNull();
  });
});
