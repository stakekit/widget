import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { SKAtomRegistryProvider } from "../../../src/app/composition/providers/atom-runtime";
import { applicationRoutes } from "../../../src/app/routes/application-routes";
import { useTrackEvent } from "../../../src/features/tracking/react/use-track-event";
import { useTrackPage } from "../../../src/features/tracking/react/use-track-page";
import { renderHook } from "../../utils/test-utils.dom.tsx";

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
        useTrackPage("positionDetails", { yield: "Test yield" });
        return useTrackEvent();
      },
      { wrapper }
    );

    hook.result.current("txSigned", {
      network: "ethereum",
      txId: "transaction-1",
      yieldId: "ethereum-eth-lido-staking",
    });

    await vi.waitFor(() => {
      expect(tracking.trackEvent).toHaveBeenCalledWith("Transaction signed", {
        network: "ethereum",
        txId: "transaction-1",
        yieldId: "ethereum-eth-lido-staking",
      });
      expect(tracking.trackPageView).toHaveBeenCalledWith("Position details", {
        yield: "Test yield",
      });
    });
  });
});
