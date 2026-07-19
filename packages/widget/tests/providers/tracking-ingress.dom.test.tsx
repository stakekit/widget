import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { TrackingContextProvider } from "../../src/app/composition/providers/tracking";
import { useTrackEvent } from "../../src/features/tracking/react/use-track-event";
import { useTrackPage } from "../../src/features/tracking/react/use-track-page";
import { renderHook } from "../utils/test-utils.dom";

describe("public tracking ingress", () => {
  it("delivers event and page commands to host and variant adapters", async () => {
    const tracking = {
      trackEvent: vi.fn(),
      trackPageView: vi.fn(),
    };
    const variantTracking = {
      trackEvent: vi.fn(),
      trackPageView: vi.fn(),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <TrackingContextProvider
        tracking={tracking}
        variantTracking={variantTracking}
      >
        {children}
      </TrackingContextProvider>
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
      expect(variantTracking.trackEvent).toHaveBeenCalledWith(
        "Transaction signed",
        { txId: "transaction-1" }
      );
      expect(variantTracking.trackPageView).toHaveBeenCalledWith("Earn", {
        source: "test",
      });
    });
  });
});
