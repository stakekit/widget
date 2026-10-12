/**
 * Writes `dist/types/index.{package,bundle}.d.ts`. Run after
 * `tsc --project tsconfig.build.json`, which emits the `src/public-api`
 * declarations these entries reference.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { widgetRoot } from "../paths";
import {
  packageEntries,
  transpileEntryDeclaration,
} from "./entry-declarations.ts";

const declarationRoot = join(widgetRoot, "dist/types");
await mkdir(declarationRoot, { recursive: true });

for (const entry of packageEntries) {
  const {
    diagnostics,
    implementationImports,
    outputText,
    unexportedSignatureTypes,
    wildcardExports,
  } = await transpileEntryDeclaration(entry);

  if (diagnostics.length > 0) {
    throw new Error(
      `src/${entry}.ts must state every public type explicitly:\n${diagnostics.join("\n")}`
    );
  }
  if (implementationImports.length > 0) {
    throw new Error(
      `src/${entry}.ts publishes implementation modules: ${implementationImports.join(", ")}. ` +
        "Annotate exported values with src/public-api types."
    );
  }
  if (unexportedSignatureTypes.length > 0 || wildcardExports.length > 0) {
    throw new Error(
      `src/${entry}.ts must export by name every type in its signatures ` +
        `(missing: ${unexportedSignatureTypes.join(", ") || "none"}; ` +
        `wildcards: ${wildcardExports.join(", ") || "none"}).`
    );
  }

  await writeFile(join(declarationRoot, `${entry}.d.ts`), outputText);
  console.log(`[declarations] wrote dist/types/${entry}.d.ts`);
}
