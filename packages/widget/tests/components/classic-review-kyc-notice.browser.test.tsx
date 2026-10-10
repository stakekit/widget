import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { KycGate } from "../../src/domain/earn/kyc";
import type { useStakeReview } from "../../src/features/classic-transaction-flow/ui/review/hooks/use-stake-review.hook";
import { StakeReviewPage } from "../../src/features/classic-transaction-flow/ui/review/pages/stake-review.page";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../fixtures";
import { TestWidgetConfigProvider } from "../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();

const hookState = vi.hoisted(() => ({
  current: undefined as unknown as ReturnType<typeof useStakeReview>,
}));

vi.mock(
  "../../src/features/classic-transaction-flow/ui/review/hooks/use-stake-review.hook",
  () => ({
    useStakeReview: () => hookState.current,
  })
);

const stake = yieldApiYieldFixture();

const renderStakeReview = ({
  gate,
  isChecking,
}: {
  readonly gate: KycGate;
  readonly isChecking: boolean;
}) => {
  hookState.current = {
    amount: "1",
    commissionFee: null,
    cta: null,
    depositFee: null,
    estimatedRewardAmounts: null,
    fee: "0",
    feeConfigLoading: false,
    gasCheckLoading: false,
    interestRate: "",
    isGasCheckWarning: false,
    kycGate: gate,
    kycProviderName: "Superstate",
    kycStatusIsChecking: isChecking,
    managementFee: null,
    metadata: {
      logoURI: stake.metadata.logoURI,
      name: stake.metadata.name,
      provider: undefined,
    },
    metaInfo: { showMetaInfo: false },
    onKycStatusRefresh: vi.fn(),
    performanceFee: null,
    rewardToken: null,
    token: stake.token,
    yieldType: "Stake",
  };

  return render(
    <I18nextProvider i18n={i18nInstance}>
      <TestWidgetConfigProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        variant="default"
      >
        <MemoryRouter>
          <StakeReviewPage />
        </MemoryRouter>
      </TestWidgetConfigProvider>
    </I18nextProvider>
  );
};

const pageChildCount = (container: HTMLElement) =>
  container.querySelector('[data-rk="page-container"]')?.childElementCount;

describe("Classic review KYC notice", () => {
  it("adds the card in its own spacing wrapper only when KYC needs attention", async () => {
    const passed = await renderStakeReview({
      gate: { state: "pass" },
      isChecking: false,
    });
    await expect
      .element(passed.getByText(i18nInstance.t("shared.fees")))
      .toBeInTheDocument();
    expect(passed.getByTestId(/^kyc-gate-card/).elements()).toHaveLength(0);
    const passedChildCount = pageChildCount(passed.container);
    await passed.unmount();

    const blocked = await renderStakeReview({
      gate: { state: "start_kyc" },
      isChecking: false,
    });
    await expect
      .element(blocked.getByTestId("kyc-gate-card-start_kyc"))
      .toBeInTheDocument();
    expect(pageChildCount(blocked.container)).toBe((passedChildCount ?? 0) + 1);
    await blocked.unmount();
  });

  it("shows the checking card while a passed gate is being re-checked", async () => {
    const app = await renderStakeReview({
      gate: { state: "pass" },
      isChecking: true,
    });

    await expect
      .element(app.getByTestId("kyc-gate-card-checking"))
      .toBeInTheDocument();

    await app.unmount();
  });

  it.each([
    { state: "pending" },
    { state: "rejected" },
    { state: "unknown", retryable: true },
  ] satisfies ReadonlyArray<KycGate>)(
    "shows the card for a $state gate",
    async (gate) => {
      const app = await renderStakeReview({ gate, isChecking: false });

      await expect
        .element(app.getByTestId(`kyc-gate-card-${gate.state}`))
        .toBeInTheDocument();

      await app.unmount();
    }
  );
});
