import { create } from "zustand";
import type { CatalogItem } from "@contracts/catalog";
import type { Identifier } from "@contracts/common";
import type { GeneratedFile, PackageBuildResult, PackageManifest } from "@contracts/package";
import type { Project } from "@contracts/project";

import { sha256HexOfText } from "../adapters/hash";
import { buildZipBlob } from "../adapters/zip";
import { downloadBlob, downloadText } from "../adapters/downloadText";
import { downloadJson } from "../adapters/downloadJson";
import { buildFileSet, PACKAGE_GENERATOR_VERSION } from "../domain/packageGenerator";
import { RECOMMENDATION_RULE_SET_VERSION } from "../catalog/recommendationRules";
import { SYSTEM_CATALOG_VERSION } from "../catalog/systemCatalog";
import { TEMPLATE_SET_VERSION } from "../catalog/packageTemplates";
import { selectAllCatalogItems, useCatalogStore } from "./catalogStore";
import { useProjectsStore } from "./projectsStore";

/** Live-computed package preview/export — mirrors `recommendationsStore`'s pattern of recomputing from source stores rather than persisting a derived snapshot. */
export async function computePackageBuildResult(
  project: Project,
  catalogItems: CatalogItem[],
): Promise<PackageBuildResult> {
  const { files: renderedFiles, issues } = buildFileSet({
    project,
    catalogItems,
    catalogVersion: SYSTEM_CATALOG_VERSION,
    ruleSetVersion: RECOMMENDATION_RULE_SET_VERSION,
  });

  const files: GeneratedFile[] = await Promise.all(
    renderedFiles.map(async (file) => ({
      path: file.path,
      mediaType: file.mediaType,
      encoding: "utf-8" as const,
      content: file.content,
      contentHash: await sha256HexOfText(file.content),
      source: file.source,
      sourceId: file.sourceId,
      inclusionReason: file.inclusionReason,
      required: file.required,
      editable: file.editable,
      excludable: file.excludable,
    })),
  );

  const manifest: PackageManifest = {
    schemaVersion: 1,
    generatorVersion: PACKAGE_GENERATOR_VERSION,
    projectId: project.id,
    projectRevision: project.revision,
    catalogVersion: SYSTEM_CATALOG_VERSION,
    ruleSetVersion: RECOMMENDATION_RULE_SET_VERSION,
    templateSetVersion: TEMPLATE_SET_VERSION,
    outputLanguage: project.packageSettings.outputLanguage,
    selectedItems: project.selections
      .filter((selection) => selection.decision === "accepted")
      .map((selection) => selection.snapshot),
    files: files.map((file) => ({
      path: file.path,
      mediaType: file.mediaType,
      contentHash: file.contentHash,
      source: file.source,
      sourceId: file.sourceId,
      inclusionReason: file.inclusionReason,
    })),
    warnings: issues,
  };

  const canExport = issues.every((issue) => issue.severity !== "blocker");
  return { manifest, files, issues, canExport };
}

interface PackageState {
  resultsByProjectId: Record<Identifier, PackageBuildResult>;
  generate: (projectId: Identifier) => Promise<PackageBuildResult | undefined>;
  setExcluded: (projectId: Identifier, path: string, excluded: boolean) => Promise<void>;
  setOverride: (projectId: Identifier, path: string, content: string | undefined) => Promise<void>;
  downloadZip: (projectId: Identifier) => Promise<void>;
  downloadManifestJson: (projectId: Identifier) => void;
  downloadMarkdownBundle: (projectId: Identifier) => void;
  downloadFile: (projectId: Identifier, path: string) => void;
}

function findProject(projectId: Identifier): Project | undefined {
  return useProjectsStore.getState().projects.find((candidate) => candidate.id === projectId);
}

export const usePackageStore = create<PackageState>((set, get) => ({
  resultsByProjectId: {},

  generate: async (projectId) => {
    const project = findProject(projectId);
    if (!project) return undefined;
    const catalogItems = selectAllCatalogItems(useCatalogStore.getState());
    const result = await computePackageBuildResult(project, catalogItems);
    set((state) => ({
      resultsByProjectId: { ...state.resultsByProjectId, [projectId]: result },
    }));
    return result;
  },

  setExcluded: async (projectId, path, excluded) => {
    const project = findProject(projectId);
    if (!project) return;
    const current = new Set(project.packageSettings.excludedOptionalPaths);
    if (excluded) current.add(path);
    else current.delete(path);
    useProjectsStore.getState().updateProjectDraft(projectId, {
      packageSettings: { ...project.packageSettings, excludedOptionalPaths: [...current] },
    });
    await useProjectsStore.getState().saveProjectNow(projectId);
    await get().generate(projectId);
  },

  setOverride: async (projectId, path, content) => {
    const project = findProject(projectId);
    if (!project) return;
    const overrides = { ...project.packageSettings.textOverrides };
    if (content === undefined) delete overrides[path];
    else overrides[path] = content;
    useProjectsStore.getState().updateProjectDraft(projectId, {
      packageSettings: { ...project.packageSettings, textOverrides: overrides },
    });
    await useProjectsStore.getState().saveProjectNow(projectId);
    await get().generate(projectId);
  },

  downloadZip: async (projectId) => {
    const result = get().resultsByProjectId[projectId];
    const project = findProject(projectId);
    if (!result || !project || !result.canExport) return;
    const blob = await buildZipBlob(
      result.files.map((file) => ({ path: file.path, content: file.content })),
    );
    downloadBlob(`${project.meta.slug || "devflow-package"}.zip`, blob);
  },

  downloadManifestJson: (projectId) => {
    const result = get().resultsByProjectId[projectId];
    const project = findProject(projectId);
    if (!result || !project) return;
    downloadJson(`${project.meta.slug || "devflow-package"}-manifest.json`, {
      manifest: result.manifest,
      files: result.files,
    });
  },

  downloadMarkdownBundle: (projectId) => {
    const result = get().resultsByProjectId[projectId];
    const project = findProject(projectId);
    if (!result || !project) return;
    const markdownFiles = result.files.filter((file) => file.mediaType === "text/markdown");
    const bundle = markdownFiles
      .map((file) => `<!-- ${file.path} -->\n\n${file.content}`)
      .join("\n\n---\n\n");
    downloadText(`${project.meta.slug || "devflow-package"}-docs.md`, bundle, "text/markdown");
  },

  downloadFile: (projectId, path) => {
    const result = get().resultsByProjectId[projectId];
    if (!result) return;
    const file = result.files.find((candidate) => candidate.path === path);
    if (!file) return;
    const filename = path.split("/").pop() ?? path;
    downloadText(filename, file.content, file.mediaType);
  },
}));
