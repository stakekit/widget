import { describe, expect, it } from "vitest";

import {
  findParityIssues,
  findUnusedKeys,
  translationLeaves,
} from "../../scripts/translations/translation-rules";

describe("translation parity", () => {
  it("reports keys one language lacks and differing placeholders or components", () => {
    const english = translationLeaves({
      a: { link: "See <link0>terms</link0>", count: "{{count}} items" },
      only_english: "Hi",
    });
    const french = translationLeaves({
      a: { link: "Voir les conditions", count: "{{total}} éléments" },
      only_french: "Salut",
    });

    expect(findParityIssues(english, french)).toEqual([
      "French lacks only_english",
      "English lacks only_french",
      "a.link has different placeholders in French",
      "a.count has different placeholders in French",
    ]);
  });
});

describe("unused translation keys", () => {
  const keys = [
    "steps.title",
    "steps.count_one",
    "steps.count_other",
    "position.pending_action.claim_ethena_usde",
    "borrow.tx_type.supply",
    "tos.sections.contact.title",
    "errors.SomeApiError.title",
    "shared.dead",
  ];

  it("counts literal reads, plural and context forms, template prefixes and whole-object reads as used", () => {
    const source = [
      't("steps.title")',
      't("steps.count", { count })',
      't("position.pending_action.claim", { context })',
      "t(`borrow.tx_type.${type}`)",
      't("tos.sections", { returnObjects: true })',
    ].join("\n");

    expect(findUnusedKeys(keys, source)).toEqual(["shared.dead"]);
  });
});
