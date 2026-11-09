import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { useEnterReview } from "../../../src/features/yield-transaction-flow/ui/review/hooks/use-enter-review.hook";
import type { useExitReview } from "../../../src/features/yield-transaction-flow/ui/review/hooks/use-exit-review.hook";
import { EnterReviewPage } from "../../../src/features/yield-transaction-flow/ui/review/pages/enter-review.page";
import { ExitReviewPage } from "../../../src/features/yield-transaction-flow/ui/review/pages/exit-review.page";
import type { FeesBps } from "../../../src/features/yield-transaction-flow/ui/review/types";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../../fixtures";
import { TestWidgetConfigProvider } from "../../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();

const hookState = vi.hoisted(() => ({
  current: undefined as unknown as ReturnType<typeof useEnterReview>,
  exit: undefined as unknown as ReturnType<typeof useExitReview>,
}));

vi.mock(
  "../../../src/features/yield-transaction-flow/ui/review/hooks/use-enter-review.hook",
  () => ({
    useEnterReview: () => hookState.current,
  })
);

vi.mock(
  "../../../src/features/yield-transaction-flow/ui/review/hooks/use-exit-review.hook",
  () => ({
    useExitReview: () => hookState.exit,
  })
);

const stake = yieldApiYieldFixture();

type Review = ReturnType<typeof useEnterReview>;

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
      | "fee"
      | "feeConfigLoading"
      | "gasCheckLoading"
      | "isGasCheckWarning"
      | "cta"
    >
  >;
  readonly hideGasFee?: boolean;
}) => {
  hookState.current = {
    amount: "1",
    amountFiat: null,
    attribution: null,
    feeWarning: null,
    commissionFee: null,
    cta: null,
    depositFee: null,
    destination: "Test yield via Test provider",
    facts: [],
    fee: "0.0021 ETH ($4.20)",
    feeConfigLoading: false,
    gasCheckLoading: false,
    isGasCheckWarning: false,
    kycGate: { state: "pass" },
    kycProviderName: null,
    kycStatusIsChecking: false,
    managementFee: null,
    metaInfo: { showMetaInfo: false },
    onKycStatusRefresh: vi.fn(),
    performanceFee: null,
    token: stake.token,
    yieldType: "Stake",
    ...fees,
  };

  return render(
    <I18nextProvider i18n={i18nInstance}>
      <TestWidgetConfigProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        {...(hideGasFee === undefined ? {} : { hideGasFee })}
        variant="default"
      >
        <MemoryRouter>
          <EnterReviewPage />
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

  it("shows the gas estimate as unavailable once none settled", async () => {
    const app = await renderStakeReview({ fees: { fee: null } });

    await expect
      .element(app.getByTestId("estimated_gas_fee").getByText("Unavailable"))
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
      .element(app.getByText("By selecting Confirm", { exact: false }))
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

  it("turns Confirm into a secondary Confirm anyway under the gas warning", async () => {
    const onClick = vi.fn();
    const app = await renderStakeReview({
      fees: {
        cta: { disabled: false, isLoading: false, label: "Confirm", onClick },
        isGasCheckWarning: true,
      },
    });

    const button = app.getByRole("button", { name: "Confirm anyway" });
    await expect.element(button).toBeEnabled();
    await expect
      .element(button)
      .toHaveAttribute("data-rk", "footer-button-secondary");
    await expect
      .element(
        app.getByText("This action is unlikely to succeed", { exact: false })
      )
      .toBeInTheDocument();
    expect(
      app.getByRole("button", { name: "Confirm", exact: true }).query()
    ).toBeNull();
    await button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps a full-strength Confirm without a gas warning", async () => {
    const app = await renderStakeReview({
      fees: {
        cta: {
          disabled: false,
          isLoading: false,
          label: "Confirm",
          onClick: vi.fn(),
        },
      },
    });

    await expect
      .element(app.getByRole("button", { name: "Confirm", exact: true }))
      .toHaveAttribute("data-rk", "footer-button-primary");
  });
});

const renderExitReview = (withdrawalFee: FeesBps | null) => {
  hookState.exit = {
    amount: "1",
    amountFiat: null,
    attribution: null,
    cta: null,
    destination: "Test yield via Test provider",
    facts: [],
    fee: "0.0021 ETH ($4.20)",
    feeWarning: null,
    gasCheckLoading: false,
    integrationData: stake,
    isGasCheckWarning: false,
    kycGate: { state: "pass" },
    kycProviderName: null,
    kycStatusIsChecking: false,
    metaInfo: { showMetaInfo: false },
    onKycStatusRefresh: vi.fn(),
    title: "Withdraw",
    token: stake.token,
    withdrawalFee,
  };

  return render(
    <I18nextProvider i18n={i18nInstance}>
      <TestWidgetConfigProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        variant="default"
      >
        <MemoryRouter>
          <ExitReviewPage />
        </MemoryRouter>
      </TestWidgetConfigProvider>
    </I18nextProvider>
  );
};

describe("Yield exit review fees", () => {
  it("lists the yield's withdrawal fee beside the gas fee, explained", async () => {
    const app = await renderExitReview({
      explanation: "Charged on withdrawal",
      inPercentage: "0.10%",
      inUSD: "0.001 ETH ($2.00)",
      label: "Withdrawal fee",
    });

    await expect.element(app.getByText("Withdrawal fee")).toBeInTheDocument();
    await expect.element(app.getByText("0.10%")).toBeInTheDocument();
    await expect
      .element(app.getByRole("button", { name: "About Withdrawal fee" }))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Estimated gas fee"))
      .toBeInTheDocument();
  });

  it("lists no withdrawal fee when the yield charges none", async () => {
    const app = await renderExitReview(null);

    await expect
      .element(app.getByText("Estimated gas fee"))
      .toBeInTheDocument();
    expect(app.getByText("Withdrawal fee").query()).toBeNull();
  });
});

describe("Yield review header", () => {
  it("heads the amount with the token being sent, not the yield's", async () => {
    const app = await renderStakeReview({});
    const avatar = app.getByRole("img", { name: stake.token.name });

    await expect.element(avatar).toBeVisible();
    expect(stake.token.name).not.toBe(stake.metadata.name);
    expect(
      app.getByRole("img", { name: stake.metadata.name }).query()
    ).toBeNull();
  });
});
