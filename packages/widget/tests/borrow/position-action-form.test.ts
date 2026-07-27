import * as Schema from "effect/Schema";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { Integration } from "../../src/domain/borrow/integration";
import { Market } from "../../src/domain/borrow/market";
import { BorrowAccountPosition } from "../../src/domain/borrow/position";
import { deriveBorrowPositionItems } from "../../src/domain/borrow/position-items";
import { TokenBalancesResponse } from "../../src/domain/schema/financial-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  applyBorrowRepayFormAction,
  applyBorrowWithdrawFormAction,
  makeDefaultBorrowRepayFormIntent,
  makeDefaultBorrowWithdrawFormIntent,
  resolveBorrowCollateralToggleReviewState,
  resolveBorrowRepayFormView,
  resolveBorrowWithdrawFormView,
} from "../../src/features/borrow/model/position-action-form";
import { getBorrowPositionActions } from "../../src/features/borrow/model/position-details-model";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

const loanTokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const collateralTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const marketDto = {
  id: "aave-v3-ethereum-usdc",
  integrationId: "aave-borrow",
  network: "ethereum",
  type: "pool",
  poolAddress: "0x0000000000000000000000000000000000000001",
  loanToken: {
    address: loanTokenAddress,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  collateralTokens: [
    {
      token: {
        address: collateralTokenAddress,
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
      },
      priceUsd: "2000",
      maxLtv: "0.8",
      liquidationThreshold: "0.85",
      liquidationPenalty: "0.05",
      supplyRate: "0.02",
    },
  ],
  borrowRate: "0.06",
  totalSupply: "1000000",
  totalSupplyRaw: "1000000000000",
  totalBorrow: "500000",
  totalBorrowRaw: "500000000000",
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
  utilizationRate: "0.5",
  loanTokenPriceUsd: "1",
  isBorrowEnabled: true,
  supplyCollateralFeeBps: "0",
  feeWrapperAddress: null,
  minLoan: null,
} as const;

const integrationDto = {
  id: "aave-borrow",
  providerId: "aave",
  name: "Aave V3",
  networks: ["ethereum"],
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  actions: [],
} as const;

const accountPositionDto = Schema.decodeUnknownSync(BorrowAccountPosition)({
  address,
  availableToBorrowUsd: "450",
  currentLtv: "0.4",
  debtBalances: [
    {
      apy: "0.06",
      balance: "400",
      balanceRaw: "400000000",
      balanceUsd: "400",
      marketId: marketDto.id,
      pendingActions: [
        {
          args: { marketId: marketDto.id, tokenAddress: loanTokenAddress },
          label: "Repay",
          type: "repay",
        },
      ],
      tokenAddress: loanTokenAddress,
      tokenSymbol: "USDC",
    },
  ],
  healthFactor: "2.125",
  integrationId: integrationDto.id,
  netApy: "-0.006",
  netWorthUsd: "600",
  network: "ethereum",
  supplyBalances: [
    {
      apy: "0.02",
      balance: "0.5",
      balanceRaw: "500000000000000000",
      balanceUsd: "1000",
      isCollateral: true,
      marketId: marketDto.id,
      pendingActions: [
        {
          args: {
            amountRaw: "500000000000000000",
            marketId: marketDto.id,
            tokenAddress: collateralTokenAddress,
          },
          label: "Withdraw",
          type: "withdraw",
        },
        {
          args: {
            marketId: marketDto.id,
            tokenAddress: collateralTokenAddress,
          },
          label: "Disable collateral",
          type: "disableCollateral",
        },
      ],
      tokenAddress: collateralTokenAddress,
      tokenSymbol: "WETH",
    },
  ],
  totalBorrowedUsd: "400",
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
});

const walletBalances = Schema.decodeUnknownSync(TokenBalancesResponse)([
  {
    token: {
      network: "ethereum",
      address: loanTokenAddress,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    amount: "150",
    availableYields: [],
  },
]);

const t = ((key: string) => key) as TFunction;

const getPositionActions = () => {
  const [position] = deriveBorrowPositionItems({
    integrationPositions: [
      {
        integration: Schema.decodeUnknownSync(Integration)(integrationDto),
        position: accountPositionDto,
      },
    ],
    markets: [Schema.decodeUnknownSync(Market)(marketDto)],
  });

  if (!position) {
    throw new Error("Expected borrow position");
  }

  return getBorrowPositionActions({ address, position, t });
};

const getActionContext = (type: "repay" | "withdraw" | "disableCollateral") => {
  const action = getPositionActions().find(
    (candidate) => candidate.pendingContext.type === type
  );

  if (!action) {
    throw new Error(`Expected ${type} action`);
  }

  return action.pendingContext;
};

describe("borrow repay form", () => {
  const context = getActionContext("repay");

  if (context.type !== "repay") {
    throw new Error("Expected repay context");
  }

  it("starts empty and cannot be submitted", () => {
    const view = resolveBorrowRepayFormView({
      address,
      context,
      intent: makeDefaultBorrowRepayFormIntent(),
      tokenBalances: walletBalances,
    });

    expect(view.amount.toString(10)).toBe("0");
    expect(view.repayAll).toBe(false);
    expect(view.canSubmit).toBe(false);
    expect(view.reviewState).toBeNull();
  });

  it("projects debt and ltv for a partial repayment", () => {
    const intent = applyBorrowRepayFormAction({
      action: { amount: 100, type: "amount/set" },
      intent: makeDefaultBorrowRepayFormIntent(),
    });
    const view = resolveBorrowRepayFormView({
      address,
      context,
      intent,
      tokenBalances: walletBalances,
    });

    expect(view.canSubmit).toBe(true);
    expect(view.repayUsd.toString(10)).toBe("100");
    expect(view.remainingDebt).toBe(300);
    expect(view.projectedLtv).toBeCloseTo(0.3);
    expect(view.reviewState?.request.args).toMatchObject({ amount: "100" });
    expect(view.reviewState?.summary).toMatchObject({
      action: "repay",
      loanTokenSymbol: "USDC",
    });
  });

  it("repays the full debt when the repay all intent is set", () => {
    const intent = applyBorrowRepayFormAction({
      action: { repayAll: true, type: "repayAll/set" },
      intent: makeDefaultBorrowRepayFormIntent(),
    });
    const view = resolveBorrowRepayFormView({
      address,
      context,
      intent,
      tokenBalances: null,
    });

    expect(view.repayAll).toBe(true);
    expect(view.canSubmit).toBe(true);
    expect(view.remainingDebt).toBe(0);
    expect(view.reviewState?.request.args).toMatchObject({ repayAll: true });
  });

  it("reports a repayment larger than the wallet balance", () => {
    const intent = applyBorrowRepayFormAction({
      action: { amount: 200, type: "amount/set" },
      intent: makeDefaultBorrowRepayFormIntent(),
    });
    const view = resolveBorrowRepayFormView({
      address,
      context,
      intent,
      tokenBalances: walletBalances,
    });

    expect(view.error).toBe("walletBalance");
    expect(view.canSubmit).toBe(false);
    expect(view.reviewState).toBeNull();
  });

  it("reports a repayment larger than the outstanding debt", () => {
    const intent = applyBorrowRepayFormAction({
      action: { amount: 500, type: "amount/set" },
      intent: makeDefaultBorrowRepayFormIntent(),
    });
    const view = resolveBorrowRepayFormView({
      address,
      context,
      intent,
      tokenBalances: null,
    });

    expect(view.error).toBe("repayDebt");
    expect(view.canSubmit).toBe(false);
  });

  it("drops the staged amount and repay all intent on reset", () => {
    expect(
      applyBorrowRepayFormAction({
        action: { type: "reset" },
        intent: { amount: "100", repayAll: true },
      })
    ).toEqual(makeDefaultBorrowRepayFormIntent());
  });
});

describe("borrow withdraw form", () => {
  const context = getActionContext("withdraw");

  if (context.type !== "withdraw") {
    throw new Error("Expected withdraw context");
  }

  it("defaults to the first withdrawable token", () => {
    const view = resolveBorrowWithdrawFormView({
      address,
      context,
      intent: makeDefaultBorrowWithdrawFormIntent(),
    });

    expect(view?.selectedToken.supplyBalance.tokenSymbol).toBe("WETH");
    expect(view?.canSubmit).toBe(false);
  });

  it("projects collateral and ltv for a partial withdrawal", () => {
    const intent = applyBorrowWithdrawFormAction({
      action: { amount: "0.1", type: "amount/set" },
      intent: makeDefaultBorrowWithdrawFormIntent(),
    });
    const view = resolveBorrowWithdrawFormView({ address, context, intent });

    expect(view?.canSubmit).toBe(true);
    expect(view?.withdrawUsd.toString(10)).toBe("200");
    expect(view?.projectedCollateralUsd).toBe(800);
    expect(view?.projectedLtv).toBeCloseTo(0.5);
    expect(view?.reviewState?.summary).toMatchObject({
      action: "withdraw",
      collateralTokenSymbol: "WETH",
    });
  });

  it("rejects a withdrawal larger than the supplied balance", () => {
    const intent = applyBorrowWithdrawFormAction({
      action: { amount: 1, type: "amount/set" },
      intent: makeDefaultBorrowWithdrawFormIntent(),
    });
    const view = resolveBorrowWithdrawFormView({ address, context, intent });

    expect(view?.error).toBe("withdrawBalance");
    expect(view?.canSubmit).toBe(false);
  });

  it("rejects a withdrawal that pushes ltv past the collateral maximum", () => {
    const intent = applyBorrowWithdrawFormAction({
      action: { amount: "0.3", type: "amount/set" },
      intent: makeDefaultBorrowWithdrawFormIntent(),
    });
    const view = resolveBorrowWithdrawFormView({ address, context, intent });

    expect(view?.error).toBe("withdrawLtv");
    expect(view?.canSubmit).toBe(false);
  });

  it("clears the amount when another collateral token is selected", () => {
    const intent = applyBorrowWithdrawFormAction({
      action: { amount: "0.1", type: "amount/set" },
      intent: makeDefaultBorrowWithdrawFormIntent(),
    });

    expect(
      applyBorrowWithdrawFormAction({
        action: { tokenAddress: collateralTokenAddress, type: "token/select" },
        intent,
      })
    ).toEqual({ amount: "0", selectedTokenAddress: collateralTokenAddress });
  });

  it("drops the staged amount and token selection on reset", () => {
    expect(
      applyBorrowWithdrawFormAction({
        action: { type: "reset" },
        intent: {
          amount: "0.1",
          selectedTokenAddress: collateralTokenAddress,
        },
      })
    ).toEqual(makeDefaultBorrowWithdrawFormIntent());
  });
});

describe("borrow collateral toggle", () => {
  it("builds a review state from the current position", () => {
    const context = getActionContext("disableCollateral");

    if (context.type !== "disableCollateral") {
      throw new Error("Expected disable collateral context");
    }

    const reviewState = resolveBorrowCollateralToggleReviewState({
      address,
      context,
    });

    expect(reviewState.request.action).toBe("disableCollateral");
    expect(reviewState.summary).toMatchObject({
      action: "disableCollateral",
      collateralTokenSymbol: "WETH",
      marketLabel: "WETH / USDC",
      providerName: "Aave V3",
    });
  });
});
