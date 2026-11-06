import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { useStepsSummary } from "../../../src/features/yield-transaction-flow/ui/steps/hooks/use-steps-summary.hook";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../../fixtures";
import { renderHook } from "../../utils/test-utils.dom";

const stake = yieldApiYieldFixture();

vi.mock(
  "../../../src/features/yield-transaction-flow/react/yield-flow-route",
  () => ({
    useYieldFlowSession: () => ({
      intake: {
        _tag: "Enter",
        request: { arguments: { amount: "0.5" } },
        selectedStake: stake,
        selectedToken: stake.token,
      },
    }),
  })
);

const i18n = createWidgetI18nInstance();
const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

describe("Yield Steps summary", () => {
  it("heads the amount with the token being sent, badged with its network", async () => {
    const { result } = await renderHook(() => useStepsSummary(), { wrapper });

    expect(stake.token.name).not.toBe(stake.metadata.name);
    expect(result.current?.token).toEqual({
      name: stake.token.name,
      src: stake.token.logoURI,
      networkSrc: expect.any(String),
    });
  });
});
