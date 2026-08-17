import type { Identifier, ISODateTimeString } from "./common";
import type { CatalogItem } from "./catalog";
import type { Project } from "./project";
import type { UserSettings } from "./settings";
export interface StorageEnvelope<T> {
    schemaVersion: number;
    applicationVersion: string;
    writtenAt: ISODateTimeString;
    checksum: string;
    payload: T;
}
export interface ProjectBackupPayload {
    backupVersion: 1;
    exportedAt: ISODateTimeString;
    projects: Project[];
    userCatalogItems: CatalogItem[];
    settings?: UserSettings;
}
export interface MigrationResult<T> {
    fromVersion: number;
    toVersion: number;
    migrated: boolean;
    value: T;
    warnings: string[];
}
export interface ProjectRepository {
    list(): Promise<Project[]>;
    get(id: Identifier): Promise<Project | null>;
    save(project: Project): Promise<Project>;
    deletePermanently(id: Identifier): Promise<void>;
    exportBackup(): Promise<ProjectBackupPayload>;
    importBackup(candidate: unknown): Promise<ProjectBackupPayload>;
}
export interface CatalogRepository {
    listSystem(): Promise<CatalogItem[]>;
    listUser(): Promise<CatalogItem[]>;
    saveUser(item: CatalogItem): Promise<CatalogItem>;
    deleteUser(id: Identifier): Promise<void>;
}
export interface SettingsRepository {
    get(): Promise<UserSettings>;
    save(settings: UserSettings): Promise<UserSettings>;
    reset(): Promise<UserSettings>;
}
