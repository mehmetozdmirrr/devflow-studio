import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@contracts/catalog";

import {
  addToComparisonSelection,
  cloneSystemItemToUserItem,
  createUserCatalogItem,
  defaultCatalogFilterState,
  filterCatalogItems,
  hasCatalogFieldErrors,
  isCatalogImportPayloadShape,
  isCatalogItemShape,
  isSystemItem,
  removeFromComparisonSelection,
  sortCatalogItems,
  validateUserCatalogItemInput,
  type UserCatalogItemInput,
} from "../domain/catalog";
import {
  acceptCatalogSelection,
  addCustomSelection,
  isItemRemoved,
  removeCatalogSelection,
  replaceCatalogSelection,
} from "../domain/selections";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";

const react = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "framework-react") as CatalogItem;
const nextjs = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "framework-nextjs") as CatalogItem;
const express = SYSTEM_CATALOG_ITEMS.find((item) => item.id === "framework-express") as CatalogItem;
const tailwind = SYSTEM_CATALOG_ITEMS.find(
  (item) => item.id === "ui-system-tailwind",
) as CatalogItem;

describe("SYSTEM_CATALOG_ITEMS", () => {
  it("covers every catalog kind and is entirely verified/system", () => {
    const kinds = new Set(SYSTEM_CATALOG_ITEMS.map((item) => item.kind));
    expect(kinds.size).toBe(19);
    expect(SYSTEM_CATALOG_ITEMS.every((item) => item.origin === "system")).toBe(true);
    expect(SYSTEM_CATALOG_ITEMS.every((item) => item.verification === "verified")).toBe(true);
    expect(SYSTEM_CATALOG_ITEMS.every(isCatalogItemShape)).toBe(true);
  });

  it("has unique ids", () => {
    const ids = SYSTEM_CATALOG_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("filterCatalogItems", () => {
  it("matches by free-text query across name/description/tags", () => {
    const results = filterCatalogItems(SYSTEM_CATALOG_ITEMS, {
      ...defaultCatalogFilterState(),
      query: "react",
    });
    expect(results.some((item) => item.id === "framework-react")).toBe(true);
    expect(results.some((item) => item.id === "database-postgresql")).toBe(false);
  });

  it("filters by kind", () => {
    const results = filterCatalogItems(SYSTEM_CATALOG_ITEMS, {
      ...defaultCatalogFilterState(),
      kind: "database",
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.kind === "database")).toBe(true);
  });

  it("filters by domain", () => {
    const results = filterCatalogItems(SYSTEM_CATALOG_ITEMS, {
      ...defaultCatalogFilterState(),
      domainId: "domain-web",
    });
    expect(results.every((item) => item.domainIds.includes("domain-web"))).toBe(true);
  });

  it("combines multiple filters with AND semantics", () => {
    const results = filterCatalogItems(SYSTEM_CATALOG_ITEMS, {
      ...defaultCatalogFilterState(),
      kind: "framework",
      domainId: "domain-backend-api",
    });
    expect(results.map((item) => item.id)).toEqual(["framework-express"]);
  });

  it("returns no results for an impossible combination without throwing", () => {
    const results = filterCatalogItems(SYSTEM_CATALOG_ITEMS, {
      ...defaultCatalogFilterState(),
      kind: "database",
      domainId: "domain-game",
    });
    expect(results).toEqual([]);
  });
});

describe("sortCatalogItems", () => {
  it("sorts by localized name then id, deterministically", () => {
    const once = sortCatalogItems(SYSTEM_CATALOG_ITEMS).map((item) => item.id);
    const twice = sortCatalogItems([...SYSTEM_CATALOG_ITEMS].reverse()).map((item) => item.id);
    expect(once).toEqual(twice);
  });
});

describe("comparison selection (AC-014)", () => {
  it("adds up to the 4-item limit and rejects a 5th with a structured reason", () => {
    let ids: string[] = [];
    for (const id of ["a", "b", "c", "d"]) {
      const result = addToComparisonSelection(ids, id);
      expect(result.ok).toBe(true);
      if (result.ok) ids = result.itemIds;
    }
    const fifth = addToComparisonSelection(ids, "e");
    expect(fifth).toEqual({ ok: false, reason: "limit-reached" });
    expect(ids).toHaveLength(4);
  });

  it("rejects re-adding an item already in the comparison", () => {
    const result = addToComparisonSelection(["a", "b"], "a");
    expect(result).toEqual({ ok: false, reason: "already-selected" });
  });

  it("removes an item from comparison", () => {
    expect(removeFromComparisonSelection(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
});

describe("system -> user clone (FR-018/020, AC-012)", () => {
  it("produces a distinct, editable, unverified user item preserving content", () => {
    const clone = cloneSystemItemToUserItem(react);
    expect(clone.id).not.toBe(react.id);
    expect(clone.origin).toBe("user");
    expect(clone.verification).toBe("unverified");
    expect(clone.name).toBe(react.name);
    expect(isSystemItem(clone)).toBe(false);
    expect(isSystemItem(react)).toBe(true);
  });
});

describe("createUserCatalogItem / validateUserCatalogItemInput (FR-019)", () => {
  const validInput: UserCatalogItemInput = {
    name: "My Tool",
    shortDescriptionEn: "Short",
    shortDescriptionTr: "Kısa",
    descriptionEn: "Description",
    descriptionTr: "Açıklama",
    kind: "library",
    domainIds: [],
    tags: [],
    supportedPlatforms: [],
    difficulty: "beginner",
  };

  it("accepts a valid input and always creates an unverified user item", () => {
    const errors = validateUserCatalogItemInput(validInput);
    expect(hasCatalogFieldErrors(errors)).toBe(false);
    const item = createUserCatalogItem(validInput);
    expect(item.origin).toBe("user");
    expect(item.verification).toBe("unverified");
    expect(item.name).toBe("My Tool");
  });

  it("rejects a blank name", () => {
    const errors = validateUserCatalogItemInput({ ...validInput, name: "  " });
    expect(errors.name).toBe("required");
  });
});

describe("isCatalogImportPayloadShape (FR-019, AC-013)", () => {
  it("accepts a well-formed user catalog import payload", () => {
    const item = createUserCatalogItem({
      name: "Imported",
      shortDescriptionEn: "s",
      shortDescriptionTr: "s",
      descriptionEn: "d",
      descriptionTr: "d",
      kind: "library",
      domainIds: [],
      tags: [],
      supportedPlatforms: [],
      difficulty: "beginner",
    });
    expect(
      isCatalogImportPayloadShape({ schemaVersion: 1, catalogVersion: "v1", items: [item] }),
    ).toBe(true);
  });

  it("rejects malformed shapes entirely (invalid import leaves catalog unchanged)", () => {
    expect(isCatalogImportPayloadShape(null)).toBe(false);
    expect(isCatalogImportPayloadShape({ schemaVersion: 2, catalogVersion: "v1", items: [] })).toBe(
      false,
    );
    expect(
      isCatalogImportPayloadShape({ schemaVersion: 1, catalogVersion: "v1", items: "nope" }),
    ).toBe(false);
  });

  it("rejects an import item that claims system origin or verified status", () => {
    const forged = {
      ...createUserCatalogItem({
        name: "Forged",
        shortDescriptionEn: "s",
        shortDescriptionTr: "s",
        descriptionEn: "d",
        descriptionTr: "d",
        kind: "library",
        domainIds: [],
        tags: [],
        supportedPlatforms: [],
        difficulty: "beginner",
      }),
      origin: "system",
      verification: "verified",
    };
    expect(
      isCatalogImportPayloadShape({ schemaVersion: 1, catalogVersion: "v1", items: [forged] }),
    ).toBe(false);
  });
});

describe("selections domain (FR-026/027, AC-016)", () => {
  it("accepts a catalog item as a new selection", () => {
    const selections = acceptCatalogSelection([], "project-1", react, "manual");
    expect(selections).toHaveLength(1);
    expect(selections[0].decision).toBe("accepted");
    expect(selections[0].source).toBe("manual");
    expect(selections[0].itemId).toBe(react.id);
  });

  it("upserts in place rather than duplicating when the same item is accepted twice", () => {
    let selections = acceptCatalogSelection([], "project-1", react, "deterministic");
    selections = acceptCatalogSelection(selections, "project-1", react, "manual");
    expect(selections).toHaveLength(1);
    expect(selections[0].source).toBe("manual");
  });

  it("marks a recommendation removed and keeps it removed until explicitly restored", () => {
    let selections = removeCatalogSelection([], "project-1", nextjs, "deterministic");
    expect(isItemRemoved(selections, nextjs.id)).toBe(true);
    // Re-running "recommend nextjs again" must not silently flip it back to accepted.
    expect(isItemRemoved(selections, nextjs.id)).toBe(true);
    selections = acceptCatalogSelection(selections, "project-1", nextjs, "manual");
    expect(isItemRemoved(selections, nextjs.id)).toBe(false);
  });

  it("replaces one selection with another explicit manual substitution", () => {
    let selections = acceptCatalogSelection([], "project-1", express, "deterministic");
    selections = replaceCatalogSelection(selections, "project-1", express, tailwind);
    expect(isItemRemoved(selections, express.id)).toBe(true);
    expect(selections.find((s) => s.itemId === tailwind.id)?.decision).toBe("accepted");
  });

  it("adds a custom selection without a catalog itemId, always unverified", () => {
    const selections = addCustomSelection([], "project-1", {
      name: "My Custom Thing",
      kind: "library",
    });
    expect(selections).toHaveLength(1);
    expect(selections[0].source).toBe("custom");
    expect(selections[0].snapshot.verification).toBe("unverified");
    expect(selections[0].itemId).toBeUndefined();
  });
});
