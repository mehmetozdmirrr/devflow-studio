import type { Identifier, LocalizedText } from "@contracts/common";

import { slugify } from "./project";

export interface SystemDomain {
  id: Identifier;
  name: LocalizedText;
  tags: string[];
}

/** Mirrors catalog/seed/domains.json (schemaVersion 1, taxonomyVersion v1, allowCustom: true). */
export const SYSTEM_DOMAINS: SystemDomain[] = [
  { id: "domain-web", name: { en: "Web", tr: "Web" }, tags: ["frontend", "full-stack", "browser"] },
  {
    id: "domain-mobile",
    name: { en: "Mobile", tr: "Mobil" },
    tags: ["android", "ios", "cross-platform"],
  },
  {
    id: "domain-backend-api",
    name: { en: "Backend and API", tr: "Backend ve API" },
    tags: ["server", "rest", "graphql"],
  },
  {
    id: "domain-desktop",
    name: { en: "Desktop", tr: "Masaüstü" },
    tags: ["windows", "macos", "linux"],
  },
  {
    id: "domain-game",
    name: { en: "Game Development", tr: "Oyun Geliştirme" },
    tags: ["2d", "3d", "engine"],
  },
  {
    id: "domain-ai-ml",
    name: { en: "AI and Machine Learning", tr: "Yapay Zekâ ve Makine Öğrenmesi" },
    tags: ["models", "inference", "agents"],
  },
  {
    id: "domain-data",
    name: { en: "Data Science and Engineering", tr: "Veri Bilimi ve Mühendisliği" },
    tags: ["analytics", "pipelines", "warehouse"],
  },
  {
    id: "domain-automation-cli",
    name: { en: "Automation, Bots, and CLI", tr: "Otomasyon, Bot ve CLI" },
    tags: ["scripts", "workflow", "command-line"],
  },
  {
    id: "domain-iot-embedded",
    name: { en: "IoT and Embedded", tr: "IoT ve Gömülü Sistemler" },
    tags: ["device", "firmware", "sensors"],
  },
  {
    id: "domain-cloud-devops",
    name: { en: "Cloud and DevOps", tr: "Cloud ve DevOps" },
    tags: ["ci-cd", "containers", "infrastructure"],
  },
  {
    id: "domain-cybersecurity",
    name: { en: "Cybersecurity", tr: "Siber Güvenlik" },
    tags: ["defensive", "audit", "security-tooling"],
  },
  {
    id: "domain-blockchain",
    name: { en: "Blockchain and Web3", tr: "Blockchain ve Web3" },
    tags: ["smart-contract", "wallet", "distributed"],
  },
  {
    id: "domain-ar-vr",
    name: { en: "AR and VR", tr: "AR ve VR" },
    tags: ["spatial", "immersive", "xr"],
  },
  {
    id: "domain-browser-extension",
    name: { en: "Browser Extension", tr: "Tarayıcı Eklentisi" },
    tags: ["extension", "browser-api", "manifest"],
  },
];

export function isSystemDomainId(id: Identifier): boolean {
  return SYSTEM_DOMAINS.some((domain) => domain.id === id);
}

/** `custom-<slug>`, de-duplicated against already-used ids so two custom domains never collide. */
export function createCustomDomainId(label: string, existingIds: Identifier[]): Identifier {
  const base = `custom-${slugify(label)}`;
  if (!existingIds.includes(base)) return base;
  let suffix = 2;
  while (existingIds.includes(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

export function hasAnyDomainSelected(
  domainIds: Identifier[],
  customDomainIds: Identifier[],
): boolean {
  return domainIds.length > 0 || customDomainIds.length > 0;
}

export function validateCustomDomainLabel(label: string): "required" | undefined {
  return label.trim().length === 0 ? "required" : undefined;
}
