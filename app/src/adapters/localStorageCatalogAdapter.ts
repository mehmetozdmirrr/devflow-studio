import type { CatalogItem } from "@contracts/catalog";
import type { StorageEnvelope } from "@contracts/storage";

import { isCatalogItemListShape } from "../domain/catalog";
import { SYSTEM_CATALOG_ITEMS } from "../catalog/systemCatalog";
import type { CatalogRepository } from "../ports/catalogRepository";
import { DEVFLOW_NAMESPACE_PREFIX } from "./localStorageSettingsAdapter";
import { sha256Hex } from "./hash";

export const USER_CATALOG_STORAGE_KEY = `${DEVFLOW_NAMESPACE_PREFIX}userCatalog`;
export const USER_CATALOG_LKG_STORAGE_KEY = `${DEVFLOW_NAMESPACE_PREFIX}userCatalog:lkg`;
export const USER_CATALOG_STAGED_STORAGE_KEY = `${DEVFLOW_NAMESPACE_PREFIX}userCatalog:staged`;
const USER_CATALOG_SCHEMA_VERSION = 1;
const APPLICATION_VERSION = "phase-4";

export class CatalogStorageCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogStorageCorruptionError";
  }
}

interface RawEnvelopeShape {
  schemaVersion: number;
  applicationVersion: string;
  writtenAt: string;
  checksum: string;
  payload: unknown;
}

function isEnvelopeShape(value: unknown): value is RawEnvelopeShape {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.applicationVersion === "string" &&
    typeof candidate.writtenAt === "string" &&
    typeof candidate.checksum === "string" &&
    "payload" in candidate
  );
}

/** Shared by normal reads and staged-write readback: parse -> checksum -> shape-validate (mirrors `localStorageProjectAdapter.ts`). */
async function loadValidatedList(raw: string): Promise<CatalogItem[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CatalogStorageCorruptionError("stored user catalog envelope is not valid JSON");
  }
  if (!isEnvelopeShape(parsed)) {
    throw new CatalogStorageCorruptionError("stored user catalog envelope has an invalid shape");
  }
  const checksum = await sha256Hex(parsed.payload);
  if (checksum !== parsed.checksum) {
    throw new CatalogStorageCorruptionError(
      "stored user catalog envelope failed checksum validation",
    );
  }
  if (!isCatalogItemListShape(parsed.payload)) {
    throw new CatalogStorageCorruptionError("stored user catalog payload has an invalid shape");
  }
  return parsed.payload;
}

export class LocalStorageCatalogAdapter implements CatalogRepository {
  async listSystem(): Promise<CatalogItem[]> {
    return SYSTEM_CATALOG_ITEMS;
  }

  async listUser(): Promise<CatalogItem[]> {
    const raw = window.localStorage.getItem(USER_CATALOG_STORAGE_KEY);
    if (!raw) return [];
    try {
      return await loadValidatedList(raw);
    } catch {
      const lkgRaw = window.localStorage.getItem(USER_CATALOG_LKG_STORAGE_KEY);
      if (!lkgRaw) {
        throw new CatalogStorageCorruptionError(
          "current user catalog storage and last-known-good are both unreadable",
        );
      }
      return await loadValidatedList(lkgRaw);
    }
  }

  async saveUser(item: CatalogItem): Promise<CatalogItem> {
    const items = await this.listUser();
    const index = items.findIndex((existing) => existing.id === item.id);
    const next =
      index === -1 ? [...items, item] : items.map((existing, i) => (i === index ? item : existing));
    await this.writeList(next);
    return item;
  }

  async deleteUser(id: string): Promise<void> {
    const items = await this.listUser();
    await this.writeList(items.filter((item) => item.id !== id));
  }

  /** Staged-write protocol: validate -> stage -> readback+validate -> promote -> cleanup (mirrors `localStorageProjectAdapter.ts`). */
  async writeList(items: CatalogItem[]): Promise<void> {
    if (!isCatalogItemListShape(items)) {
      throw new CatalogStorageCorruptionError(
        "candidate user catalog list failed shape validation",
      );
    }
    const checksum = await sha256Hex(items);
    const envelope: StorageEnvelope<CatalogItem[]> = {
      schemaVersion: USER_CATALOG_SCHEMA_VERSION,
      applicationVersion: APPLICATION_VERSION,
      writtenAt: new Date().toISOString(),
      checksum,
      payload: items,
    };
    const serialized = JSON.stringify(envelope);

    try {
      window.localStorage.setItem(USER_CATALOG_STAGED_STORAGE_KEY, serialized);
      const stagedRaw = window.localStorage.getItem(USER_CATALOG_STAGED_STORAGE_KEY);
      if (!stagedRaw) {
        throw new CatalogStorageCorruptionError("staged write did not persist");
      }
      const validated = await loadValidatedList(stagedRaw);
      if (validated.length !== items.length) {
        throw new CatalogStorageCorruptionError("staged readback did not match the candidate list");
      }
      const existingCurrent = window.localStorage.getItem(USER_CATALOG_STORAGE_KEY);
      if (existingCurrent) {
        window.localStorage.setItem(USER_CATALOG_LKG_STORAGE_KEY, existingCurrent);
      }
      window.localStorage.setItem(USER_CATALOG_STORAGE_KEY, stagedRaw);
    } finally {
      window.localStorage.removeItem(USER_CATALOG_STAGED_STORAGE_KEY);
    }
  }
}
