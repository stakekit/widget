/**
 * Package and repo roots for nested widget scripts.
 *
 * `widgetRoot` is `packages/widget`. `repositoryRoot` is the monorepo root.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const widgetRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const repositoryRoot = join(widgetRoot, "../..");
