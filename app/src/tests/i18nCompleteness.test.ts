import { describe, expect, it } from "vitest";

import en from "../i18n/locales/en.json";
import tr from "../i18n/locales/tr.json";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n completeness (NFR-012)", () => {
  it("en and tr resources expose the same translation keys", () => {
    const enKeys = flattenKeys(en).sort();
    const trKeys = flattenKeys(tr).sort();

    expect(trKeys).toEqual(enKeys);
  });

  it("no translation value is empty", () => {
    for (const [locale, resource] of [
      ["en", en],
      ["tr", tr],
    ] as const) {
      for (const key of flattenKeys(resource)) {
        const value = key.split(".").reduce<unknown>((acc, part) => {
          if (typeof acc !== "object" || acc === null) return undefined;
          return (acc as Record<string, unknown>)[part];
        }, resource);
        expect(value, `${locale}:${key}`).not.toBe("");
      }
    }
  });
});
