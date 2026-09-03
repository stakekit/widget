import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { SKAtomRegistryProvider } from "../../src/app/composition/providers/atom-runtime";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { useTrackEvent } from "../../src/features/tracking/react/use-track-event";
import { useTrackPage } from "../../src/features/tracking/react/use-track-page";
import { renderHook } from "../utils/test-utils.dom.tsx";

describe("application tracking ingress", () => {
  it("delivers event and page commands to the host tracking adapter", async () => {
    const tracking = {
      trackEvent: vi.fn(),
      trackPageView: vi.fn(),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <SKAtomRegistryProvider
        hostConfiguration={{ apiKey: "test", tracking }}
        routes={applicationRoutes}
      >
        {children}
      </SKAtomRegistryProvider>
    );
    const hook = await renderHook(
      () => {
        useTrackPage("earn", { source: "test" });
        return useTrackEvent();
      },
      { wrapper }
    );

    hook.result.current("txSigned", { txId: "transaction-1" });

    await vi.waitFor(() => {
      expect(tracking.trackEvent).toHaveBeenCalledWith("Transaction signed", {
        txId: "transaction-1",
      });
      expect(tracking.trackPageView).toHaveBeenCalledWith("Earn", {
        source: "test",
      });
    });
  });
});
