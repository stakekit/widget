import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, it } from "vitest";

import { widgetRoot } from "../../../scripts/paths";
import { unknownSkAttributeReferences } from "../../../scripts/styles/sk-attribute-references";

// oxlint reads no stylesheets, so the reset's selectors are checked here: a
// misspelled attribute would match nothing and leave the Widget unreset.
it("selects only the Widget attributes skAttributes lists", async () => {
  const reset = await readFile(
    join(widgetRoot, "src", "ui", "theme", "reset.css"),
    "utf8"
  );

  expect(unknownSkAttributeReferences(reset)).toEqual([]);
});
