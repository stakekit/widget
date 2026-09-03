import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { widgetBootstrapSnapshotAtom } from "../../src/features/widget-configuration/index";
import { widgetConfigFieldAtom } from "../../src/features/widget-configuration/state/widget-config";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

describe("widget configuration projections", () => {
  it("derives focused React fields and the bootstrap snapshot from one atom", () => {
    class TestHTMLElement {}
    vi.stubGlobal("HTMLElement", TestHTMLElement);
    const portalContainer = new TestHTMLElement() as unknown as HTMLElement;
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue({
          apiKey: "api-key",
          baseUrl: "https://legacy.example.com",
          borrowApiUrl: "https://borrow.example.com",
          portalContainer,
          variant: "utila",
          yieldsApiUrl: "https://yields.example.com",
        }),
      ],
    });

    try {
      expect(registry.get(widgetConfigFieldAtom("variant"))).toBe("utila");
      expect(registry.get(widgetConfigFieldAtom("portalContainer"))).toBe(
        portalContainer
      );
      expect(registry.get(widgetBootstrapSnapshotAtom)).toMatchObject({
        api: {
          apiKey: "api-key",
          baseUrl: "https://legacy.example.com",
          borrowApiUrl: "https://borrow.example.com",
          yieldsApiUrl: "https://yields.example.com",
        },
        tracking: { variant: "utila" },
        wallet: { variant: "utila" },
      });
    } finally {
      registry.dispose();
      vi.unstubAllGlobals();
    }
  });
});
