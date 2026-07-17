import { describe, expect, it, vi } from "vitest";
import {
  makeWidgetRuntimeGenerationKey,
  normalizeWidgetConfig,
} from "../../src/app/config";

const settings = normalizeWidgetConfig({
  apiKey: "api-key",
  baseUrl: "https://legacy.example/",
  borrowApiUrl: "https://borrow.example/",
  variant: "default",
  yieldsApiUrl: "https://yield.example/",
});

describe("WidgetRuntimeGenerationKey", () => {
  it("is equal for reconstructed API configuration", () => {
    const first = makeWidgetRuntimeGenerationKey(settings);
    const equivalent = makeWidgetRuntimeGenerationKey({ ...settings });

    expect(first).toBe(equivalent);
  });

  it("ignores live tracking callback identity", () => {
    const first = makeWidgetRuntimeGenerationKey({
      ...settings,
      tracking: { trackEvent: vi.fn() },
    });
    const second = makeWidgetRuntimeGenerationKey({
      ...settings,
      tracking: { trackEvent: vi.fn() },
    });

    expect(first).toBe(second);
  });

  it.each([
    ["apiKey", "changed-api-key"],
    ["baseUrl", "https://changed-legacy.example/"],
    ["borrowApiUrl", "https://changed-borrow.example/"],
    ["yieldsApiUrl", "https://changed-yield.example/"],
  ] as const)("changes identity when %s changes", (field, value) => {
    const first = makeWidgetRuntimeGenerationKey(settings);
    const changed = makeWidgetRuntimeGenerationKey({
      ...settings,
      [field]: value,
    });

    expect(first).not.toBe(changed);
  });
});
