import { beforeEach, describe, expect, it } from "vitest";

import {
  LocalStorageCatalogAdapter,
  USER_CATALOG_STAGED_STORAGE_KEY,
  USER_CATALOG_STORAGE_KEY,
} from "../adapters/localStorageCatalogAdapter";
import { createUserCatalogItem } from "../domain/catalog";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";

function makeUserItem(name: string) {
  return createUserCatalogItem({
    name,
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
}

describe("LocalStorageCatalogAdapter", () => {
  let adapter: LocalStorageCatalogAdapter;

  beforeEach(() => {
    adapter = new LocalStorageCatalogAdapter();
  });

  it("returns the bundled system catalog unchanged", async () => {
    const items = await adapter.listSystem();
    expect(items).toEqual(SYSTEM_CATALOG_ITEMS);
  });

  it("returns an empty user catalog before anything is saved", async () => {
    expect(await adapter.listUser()).toEqual([]);
  });

  it("saves and reads back a user item, cleaning up the staged key", async () => {
    const item = makeUserItem("Alpha");
    await adapter.saveUser(item);

    const list = await adapter.listUser();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(item.id);
    expect(window.localStorage.getItem(USER_CATALOG_STAGED_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(USER_CATALOG_STORAGE_KEY)).not.toBeNull();
  });

  it("upserts an existing user item by id instead of duplicating it", async () => {
    const item = makeUserItem("Alpha");
    await adapter.saveUser(item);
    const renamed = { ...item, name: "Alpha Renamed" };
    await adapter.saveUser(renamed);

    const list = await adapter.listUser();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Alpha Renamed");
  });

  it("deletes a user item by id", async () => {
    const item = makeUserItem("Alpha");
    await adapter.saveUser(item);
    await adapter.deleteUser(item.id);
    expect(await adapter.listUser()).toEqual([]);
  });
});
