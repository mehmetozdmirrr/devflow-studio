export const CURRENT_PROJECT_SCHEMA_VERSION = 2;

export type ProjectMigration = (payload: unknown) => unknown;

/**
 * v1 -> v2: adds `configuration.customDomainLabels` (default `{}`) so custom domains
 * created by the Phase 3 wizard have somewhere to store their user-typed label.
 * Idempotent per project entry so it is safe to run over a mixed-version array
 * (e.g. a backup import whose projects were exported at different schema versions).
 */
function migrateV1ToV2(payload: unknown): unknown {
  if (!Array.isArray(payload)) return payload;
  return payload.map((item) => {
    if (typeof item !== "object" || item === null) return item;
    const project = item as Record<string, unknown>;
    const configuration = project.configuration;
    if (typeof configuration !== "object" || configuration === null) return project;
    const configRecord = configuration as Record<string, unknown>;
    const migratedConfiguration =
      "customDomainLabels" in configRecord
        ? configRecord
        : { ...configRecord, customDomainLabels: {} };
    return { ...project, schemaVersion: 2, configuration: migratedConfiguration };
  });
}

export const PROJECT_MIGRATIONS: Record<number, ProjectMigration> = {
  1: migrateV1ToV2,
};

export class UnknownFutureSchemaVersionError extends Error {
  constructor(
    public readonly foundVersion: number,
    public readonly currentVersion: number,
  ) {
    super(`Unknown future schema version ${foundVersion}; current is ${currentVersion}`);
    this.name = "UnknownFutureSchemaVersionError";
  }
}

export class MissingMigrationStepError extends Error {
  constructor(public readonly fromStepVersion: number) {
    super(`Missing migration from schema version ${fromStepVersion} to ${fromStepVersion + 1}`);
    this.name = "MissingMigrationStepError";
  }
}

export interface MigrationRunResult {
  fromVersion: number;
  toVersion: number;
  migrated: boolean;
  value: unknown;
}

/**
 * Applies pure sequential vN -> vN+1 migrations, never skipping an intermediate step.
 * Rejects an unknown future version (fromVersion > toVersion) non-destructively.
 */
export function applyMigrations(
  payload: unknown,
  fromVersion: number,
  toVersion: number,
  registry: Record<number, ProjectMigration>,
): MigrationRunResult {
  if (fromVersion > toVersion) {
    throw new UnknownFutureSchemaVersionError(fromVersion, toVersion);
  }
  let value = payload;
  let version = fromVersion;
  let migrated = false;
  while (version < toVersion) {
    const migration = registry[version];
    if (!migration) {
      throw new MissingMigrationStepError(version);
    }
    value = migration(value);
    version += 1;
    migrated = true;
  }
  return { fromVersion, toVersion: version, migrated, value };
}
