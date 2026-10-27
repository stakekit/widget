import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { useStakeReview } from "../../../src/features/yield-transaction-flow/ui/review/hooks/use-stake-review.hook";
import { StakeReviewPage } from "../../../src/features/yield-transaction-flow/ui/review/pages/stake-review.page";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../../fixtures";
import { TestWidgetConfigProvider } from "../../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();

const hookState = vi.hoisted(() => ({
  current: undefined as unknown as ReturnType<typeof useStakeReview>,
}));

vi.mock(
  "../../../src/features/yield-transaction-flow/ui/review/hooks/use-stake-review.hook",
  () => ({
    useStakeReview: () => hookState.current,
  })
);

const stake = yieldApiYieldFixture();

type Review = ReturnType<typeof useStakeReview>;

const depositFee = {
  explanation: "Charged on deposit",
  inPercentage: "0.50%",
  inUSD: "$5.00",
  label: "Deposit fee",
};

const renderStakeReview = ({
  fees = {},
  hideGasFee,
}: {
  readonly fees?: Partial<
    Pick<
      Review,
      | "commissionFee"
      | "depositFee"
      | "feeConfigLoading"
      | "gasCheckLoading"
      | "isGasCheckWarning"
    >
  >;
  readonly hideGasFee?: boolean;
}) => {
  hookState.current = {
    amount: "1",
    commissionFee: null,
    cta: null,
    depositFee: null,
    estimatedRewardAmounts: null,
    fee: "0.0021 ETH ($4.20)",
    feeConfigLoading: false,
    gasCheckLoading: false,
    interestRate: "",
    isGasCheckWarning: false,
    kycGate: { state: "pass" },
    kycProviderName: null,
    kycStatusIsChecking: false,
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
    ...fees,
  };

  return render(
    <I18nextProvider i18n={i18nInstance}>
      <TestWidgetConfigProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        hideGasFee={hideGasFee}
        variant="default"
      >
        <MemoryRouter>
          <StakeReviewPage />
        </MemoryRouter>
      </TestWidgetConfigProvider>
    </I18nextProvider>
  );
};

describe("Yield review fees", () => {
  it("shows the estimated gas fee by default", async () => {
    const app = await renderStakeReview({});

    await expect
      .element(app.getByText("Estimated gas fee"))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("0.0021 ETH ($4.20)"))
      .toBeInTheDocument();
  });

  it("hides the gas estimate but keeps protocol fees when the host hides it", async () => {
    const app = await renderStakeReview({
      fees: { depositFee },
      hideGasFee: true,
    });

    await expect.element(app.getByText("Deposit fee")).toBeInTheDocument();
    await expect.element(app.getByText("0.50%")).toBeInTheDocument();
    expect(app.getByText("Fees", { exact: true }).query()).not.toBeNull();
    expect(app.getByText("Estimated gas fee").query()).toBeNull();
    expect(app.getByText("0.0021 ETH ($4.20)").query()).toBeNull();
  });

  it("drops the empty Fees section when the gas estimate was the only fee", async () => {
    const app = await renderStakeReview({ hideGasFee: true });

    await expect
      .element(app.getByText("By clicking confirm", { exact: false }))
      .toBeInTheDocument();
    expect(app.getByText("Fees", { exact: true }).query()).toBeNull();
  });

  it("keeps the Fees section while protocol fees load", async () => {
    const app = await renderStakeReview({
      fees: { feeConfigLoading: true },
      hideGasFee: true,
    });

    await expect
      .element(app.getByText("Fees", { exact: true }))
      .toBeInTheDocument();
    expect(app.getByText("Estimated gas fee").query()).toBeNull();
  });

  it("still warns about insufficient gas when the estimate is hidden", async () => {
    const app = await renderStakeReview({
      fees: { isGasCheckWarning: true },
      hideGasFee: true,
    });

    await expect
      .element(
        app.getByText("This action is unlikely to succeed", { exact: false })
      )
      .toBeInTheDocument();
  });
});
