import { act } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { KycGate } from "../../../src/domain/earn/kyc";
import type { useEnterReview } from "../../../src/features/yield-transaction-flow/ui/review/hooks/use-enter-review.hook";
import type { useExitReview } from "../../../src/features/yield-transaction-flow/ui/review/hooks/use-exit-review.hook";
import { EnterReviewPage } from "../../../src/features/yield-transaction-flow/ui/review/pages/enter-review.page";
import { ExitReviewPage } from "../../../src/features/yield-transaction-flow/ui/review/pages/exit-review.page";
import type { FeesBps } from "../../../src/features/yield-transaction-flow/ui/review/types";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../../fixtures";
import { render } from "../../utils/test-utils.dom";
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

/** The innermost elements whose whole text is `text`. */
const byText = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll<HTMLElement>("*")].filter(
    (element) =>
      element.textContent?.trim() === text &&
      ![...element.children].some((child) => child.textContent?.trim() === text)
  );

const button = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) =>
      (candidate.getAttribute("aria-label") ??
        candidate.textContent?.trim()) === name
  ) ?? null;

const renderStakeReview = ({
  fees = {},
  hideGasFee,
  kycGate = { state: "pass" },
  kycStatusIsChecking = false,
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
  readonly kycGate?: KycGate;
  readonly kycStatusIsChecking?: boolean;
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
    kycGate,
    kycProviderName: "Superstate",
    kycStatusIsChecking,
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
    const { container } = await renderStakeReview({});

    expect(byText(container, "Estimated gas fee")).not.toHaveLength(0);
    expect(byText(container, "0.0021 ETH ($4.20)")).not.toHaveLength(0);
  });

  it("shows the gas estimate as unavailable once none settled", async () => {
    const { container } = await renderStakeReview({ fees: { fee: null } });

    expect(
      container.querySelector('[data-testid="estimated_gas_fee"]')?.textContent
    ).toContain("Unavailable");
  });

  it("hides the gas estimate but keeps protocol fees when the host hides it", async () => {
    const { container } = await renderStakeReview({
      fees: { depositFee },
      hideGasFee: true,
    });

    expect(byText(container, "Deposit fee")).not.toHaveLength(0);
    expect(byText(container, "0.50%")).not.toHaveLength(0);
    expect(byText(container, "Fees")).not.toHaveLength(0);
    expect(byText(container, "Estimated gas fee")).toHaveLength(0);
    expect(container.textContent).not.toContain("0.0021 ETH ($4.20)");
  });

  it("drops the empty Fees section when the gas estimate was the only fee", async () => {
    const { container } = await renderStakeReview({ hideGasFee: true });

    expect(container.textContent).toContain("By selecting Confirm");
    expect(byText(container, "Fees")).toHaveLength(0);
  });

  it("keeps the Fees section while protocol fees load", async () => {
    const { container } = await renderStakeReview({
      fees: { feeConfigLoading: true },
      hideGasFee: true,
    });

    expect(byText(container, "Fees")).not.toHaveLength(0);
    expect(byText(container, "Estimated gas fee")).toHaveLength(0);
  });

  it("still warns about insufficient gas when the estimate is hidden", async () => {
    const { container } = await renderStakeReview({
      fees: { isGasCheckWarning: true },
      hideGasFee: true,
    });

    expect(container.textContent).toContain(
      "This action is unlikely to succeed"
    );
  });

  it("turns Confirm into a secondary Confirm anyway under the gas warning", async () => {
    const onClick = vi.fn();
    const { container } = await renderStakeReview({
      fees: {
        cta: { disabled: false, isLoading: false, label: "Confirm", onClick },
        isGasCheckWarning: true,
      },
    });

    const confirmAnyway = button(container, "Confirm anyway");
    expect(confirmAnyway?.disabled).toBe(false);
    expect(confirmAnyway?.getAttribute("data-rk")).toBe(
      "footer-button-secondary"
    );
    expect(container.textContent).toContain(
      "This action is unlikely to succeed"
    );
    expect(button(container, "Confirm")).toBeNull();
    await act(async () => confirmAnyway?.click());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps a full-strength Confirm without a gas warning", async () => {
    const { container } = await renderStakeReview({
      fees: {
        cta: {
          disabled: false,
          isLoading: false,
          label: "Confirm",
          onClick: vi.fn(),
        },
      },
    });

    expect(button(container, "Confirm")?.getAttribute("data-rk")).toBe(
      "footer-button-primary"
    );
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
    const { container } = await renderExitReview({
      explanation: "Charged on withdrawal",
      inPercentage: "0.10%",
      inUSD: "0.001 ETH ($2.00)",
      label: "Withdrawal fee",
    });

    expect(byText(container, "Withdrawal fee")).not.toHaveLength(0);
    expect(byText(container, "0.10%")).not.toHaveLength(0);
    expect(button(container, "About Withdrawal fee")).not.toBeNull();
    expect(byText(container, "Estimated gas fee")).not.toHaveLength(0);
  });

  it("lists no withdrawal fee when the yield charges none", async () => {
    const { container } = await renderExitReview(null);

    expect(byText(container, "Estimated gas fee")).not.toHaveLength(0);
    expect(byText(container, "Withdrawal fee")).toHaveLength(0);
  });
});

describe("Yield review header", () => {
  it("heads the amount with the token being sent, not the yield's", async () => {
    const { container } = await renderStakeReview({});
    const named = (name: string) =>
      container.querySelector(`[role="img"][aria-label="${name}"]`);

    expect(stake.token.name).not.toBe(stake.metadata.name);
    expect(named(stake.token.name)).not.toBeNull();
    expect(named(stake.metadata.name)).toBeNull();
  });
});

describe("Yield review KYC notice", () => {
  const kycCards = (container: HTMLElement) =>
    [...container.querySelectorAll("[data-testid^='kyc-gate-card']")].map(
      (card) => card.getAttribute("data-testid")
    );

  it("adds the card only when KYC needs attention", async () => {
    const passed = await renderStakeReview({});
    expect(byText(passed.container, "Fees")).not.toHaveLength(0);
    expect(kycCards(passed.container)).toEqual([]);
    passed.unmount();

    const blocked = await renderStakeReview({
      kycGate: { state: "start_kyc" },
    });
    expect(kycCards(blocked.container)).toEqual(["kyc-gate-card-start_kyc"]);
  });

  it("shows the checking card while a passed gate is being re-checked", async () => {
    const { container } = await renderStakeReview({
      kycStatusIsChecking: true,
    });

    expect(kycCards(container)).toEqual(["kyc-gate-card-checking"]);
  });
});
