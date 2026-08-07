import { describe, expect, it } from "vitest";
import { assertApplicationRuntimeIdentity } from "../../src/app/config/application-runtime-identity";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { normalizeWidgetApiConfig } from "../../src/services/config/widget-config";

const settings = normalizeWidgetConfig({
  apiKey: "api-key",
  baseUrl: "https://legacy.example/",
  borrowApiUrl: "https://borrow.example/",
  dashboardVariant: true,
  variant: "default",
  yieldsApiUrl: "https://yield.example/",
});

describe("Application Runtime identity", () => {
  it("is equal for equivalent normalized API configuration", () => {
    const first = normalizeWidgetConfig({
      apiKey: "api-key",
      variant: "default",
    });
    const api = normalizeWidgetApiConfig(first);
    const equivalent = normalizeWidgetConfig({
      apiKey: "api-key",
      baseUrl: api.baseUrl,
      borrowApiUrl: api.borrowApiUrl,
      variant: "default",
      yieldsApiUrl: api.yieldsApiUrl,
    });

    expect(() =>
      assertApplicationRuntimeIdentity(first, equivalent)
    ).not.toThrow();
  });

  it("ignores live setting changes", () => {
    const first = {
      ...settings,
      dashboardVariant: false,
    };
    const second = {
      ...settings,
      dashboardVariant: true,
    };

    expect(() => assertApplicationRuntimeIdentity(first, second)).not.toThrow();
  });

  it.each([
    ["apiKey", "changed-api-key"],
    ["baseUrl", "https://changed-legacy.example/"],
    ["borrowApiUrl", "https://changed-borrow.example/"],
    ["borrowEnabled", true],
    ["yieldsApiUrl", "https://changed-yield.example/"],
  ] as const)("rejects a change to %s", (field, value) => {
    const changed = {
      ...settings,
      [field]: value,
    };

    expect(() => assertApplicationRuntimeIdentity(settings, changed)).toThrow(
      expect.objectContaining({
        changedFields: [field],
        name: "ApplicationRuntimeIdentityChangedError",
      })
    );
  });
});
