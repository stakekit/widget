/**
 * Fails lint when generated `Schema.Union` members include unsafe empty objects.
 *
 * Run from `pnpm lint` and `pnpm check:generated-schemas`; `pnpm gen:api` runs
 * the same check after generating.
 */
import { assertGeneratedSchemasSafe } from "./generated-schema-safety";

await assertGeneratedSchemasSafe();
