import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDatabase, closeDatabase } from "../db/database.js";
import {
  listCriteriaSets,
  addCriteriaSet,
  deleteCriteriaSet,
  listCriteria,
  addCriterion,
  deleteCriterion,
} from "./criteriaService.js";

beforeEach(() => {
  openDatabase(":memory:");
});

afterEach(() => {
  closeDatabase();
});

describe("addCriteriaSet / listCriteriaSets", () => {
  it("adds a set and returns it with an id", () => {
    const set = addCriteriaSet("Accuracy");
    expect(set.id).toBeTruthy();
    expect(set.name).toBe("Accuracy");
    expect(set.createdAt).toBeGreaterThan(0);
  });

  it("listCriteriaSets returns all sets", () => {
    addCriteriaSet("Set A");
    addCriteriaSet("Set B");
    const sets = listCriteriaSets();
    expect(sets).toHaveLength(2);
    expect(sets.map((s) => s.name)).toContain("Set A");
    expect(sets.map((s) => s.name)).toContain("Set B");
  });
});

describe("deleteCriteriaSet", () => {
  it("removes the set", () => {
    const set = addCriteriaSet("To delete");
    expect(deleteCriteriaSet(set.id)).toBe(true);
    expect(listCriteriaSets()).toHaveLength(0);
  });

  it("returns false for unknown id", () => {
    expect(deleteCriteriaSet("no-such-id")).toBe(false);
  });
});

describe("addCriterion / listCriteria", () => {
  it("adds a criterion without a set using defaults", () => {
    const c = addCriterion({ name: "Relevance" });
    expect(c.id).toBeTruthy();
    expect(c.name).toBe("Relevance");
    expect(c.setId).toBeNull();
    expect(c.maxScore).toBe(10);
    expect(c.weight).toBe(1);
  });

  it("adds a criterion linked to a set", () => {
    const set = addCriteriaSet("Quality");
    const c = addCriterion({ name: "Grammar", setId: set.id, maxScore: 5, weight: 2 });
    expect(c.setId).toBe(set.id);
    expect(c.maxScore).toBe(5);
    expect(c.weight).toBe(2);
  });

  it("listCriteria with no filter returns all", () => {
    const set = addCriteriaSet("S");
    addCriterion({ name: "A", setId: set.id });
    addCriterion({ name: "B" });
    expect(listCriteria()).toHaveLength(2);
  });

  it("listCriteria filters by setId", () => {
    const set = addCriteriaSet("S");
    addCriterion({ name: "In set", setId: set.id });
    addCriterion({ name: "No set" });
    const inSet = listCriteria(set.id);
    expect(inSet).toHaveLength(1);
    expect(inSet[0]?.name).toBe("In set");
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
