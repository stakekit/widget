import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { KycGate } from "../../../src/domain/earn/kyc";
import type { useEnterReview } from "../../../src/features/yield-transaction-flow/ui/review/hooks/use-enter-review.hook";
import { EnterReviewPage } from "../../../src/features/yield-transaction-flow/ui/review/pages/enter-review.page";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../../fixtures";
import { TestWidgetConfigProvider } from "../../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();

const hookState = vi.hoisted(() => ({
  current: undefined as unknown as ReturnType<typeof useEnterReview>,
}));

vi.mock(
  "../../../src/features/yield-transaction-flow/ui/review/hooks/use-enter-review.hook",
  () => ({
    useEnterReview: () => hookState.current,
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
    amountFiat: null,
    commissionFee: null,
    cta: null,
    depositFee: null,
    destination: "Test yield via Test provider",
    facts: [],
    fee: "0",
    feeConfigLoading: false,
    gasCheckLoading: false,
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
          <EnterReviewPage />
        </MemoryRouter>
      </TestWidgetConfigProvider>
    </I18nextProvider>
  );
};

describe("Yield review KYC notice", () => {
  it("adds the card only when KYC needs attention", async () => {
    const passed = await renderStakeReview({
      gate: { state: "pass" },
      isChecking: false,
    });
    await expect
      .element(passed.getByText(i18nInstance.t("shared.fees")))
      .toBeInTheDocument();
    expect(passed.getByTestId(/^kyc-gate-card/).elements()).toHaveLength(0);
    await passed.unmount();

    const blocked = await renderStakeReview({
      gate: { state: "start_kyc" },
      isChecking: false,
    });
    await expect
      .element(blocked.getByTestId("kyc-gate-card-start_kyc"))
      .toBeInTheDocument();
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
