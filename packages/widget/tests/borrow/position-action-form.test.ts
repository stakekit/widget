import * as Schema from "effect/Schema";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { BorrowAccountSnapshot } from "../../src/domain/borrow/borrow-account-snapshot";
import { deriveBorrowPositions } from "../../src/domain/borrow/borrow-positions";
import { Integration } from "../../src/domain/borrow/integration";
import { Market } from "../../src/domain/borrow/market";
import { TokenBalancesResponse } from "../../src/domain/schema/financial-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  applyBorrowRepayFormAction,
  applyBorrowWithdrawFormAction,
  makeDefaultBorrowRepayFormIntent,
  makeDefaultBorrowWithdrawFormIntent,
  resolveBorrowCollateralToggleFormView,
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

const accountPositionDto = Schema.decodeUnknownSync(BorrowAccountSnapshot)({
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

const makePosition = ({
  market,
  snapshot = accountPositionDto,
}: {
  readonly market: typeof Market.Type;
  readonly snapshot?: typeof BorrowAccountSnapshot.Type;
}) => {
  const position = deriveBorrowPositions({
    integrationAccountSnapshots: [
      {
        integration: Schema.decodeUnknownSync(Integration)(integrationDto),
        accountSnapshot: snapshot,
      },
    ],
    markets: [market],
  }).items[0];

  if (!position) {
    throw new Error("Expected borrow position");
  }

  return position;
};

const getPositionActions = (
  market = Schema.decodeUnknownSync(Market)(marketDto)
) => {
  const position = makePosition({ market });

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

  it("allows repayment while reporting unavailable projected risk", () => {
    const unavailableSupplyBalances = context.position.balances.supply.map(
      (supplyBalance) => ({
        ...supplyBalance,
        balanceUsd: 0,
      })
    );
    const unavailableContext = {
      ...context,
      position: makePosition({
        market: context.position.market,
        snapshot: {
          ...accountPositionDto,
          totalCollateralUsd: 0,
          totalSuppliedUsd: 0,
          supplyBalances: unavailableSupplyBalances,
        },
      }),
    };
    const view = resolveBorrowRepayFormView({
      address,
      context: unavailableContext,
      intent: {
        amount: "100",
        repayAll: false,
      },
      tokenBalances: null,
    });

    expect(view.canSubmit).toBe(true);
    expect(view.projectedLtv).toBeNull();
    expect(view.riskStatus).toBe("unavailable");
    expect(view.reviewState?.summary).toMatchObject({
      riskStatus: "unavailable",
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

  it.each([
    { expectedReady: true, minLoan: null, repayAmount: 395 },
    { expectedReady: true, minLoan: "0", repayAmount: 395 },
    { expectedReady: true, minLoan: "10", repayAmount: 390 },
    { expectedReady: false, minLoan: "10", repayAmount: 395 },
    { expectedReady: true, minLoan: "10", repayAmount: 389 },
  ])(
    "enforces the remaining debt floor for minLoan=$minLoan and repayAmount=$repayAmount",
    ({ expectedReady, minLoan, repayAmount }) => {
      const minimumMarket = Schema.decodeUnknownSync(Market)({
        ...marketDto,
        minLoan,
      });
      const action = getPositionActions(minimumMarket).find(
        (candidate) => candidate.pendingContext.type === "repay"
      );

      if (action?.pendingContext.type !== "repay") {
        throw new Error("Expected repay context");
      }

      const view = resolveBorrowRepayFormView({
        address,
        context: action.pendingContext,
        intent: {
          amount: repayAmount.toString(),
          repayAll: false,
        },
        tokenBalances: null,
      });

      expect(view.canSubmit).toBe(expectedReady);
      expect(view.error).toBe(expectedReady ? null : "repayMinimum");
    }
  );

  it("allows full repayment when the market has a minimum loan", () => {
    const minimumMarket = Schema.decodeUnknownSync(Market)({
      ...marketDto,
      minLoan: "10",
    });
    const action = getPositionActions(minimumMarket).find(
      (candidate) => candidate.pendingContext.type === "repay"
    );

    if (action?.pendingContext.type !== "repay") {
      throw new Error("Expected repay context");
    }

    const view = resolveBorrowRepayFormView({
      address,
      context: action.pendingContext,
      intent: { amount: "0", repayAll: true },
      tokenBalances: null,
    });

    expect(view.canSubmit).toBe(true);
    expect(view.remainingDebt).toBe(0);
    expect(view.error).toBeNull();
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

  it("does not substitute another token for a disappeared explicit selection", () => {
    const view = resolveBorrowWithdrawFormView({
      address,
      context,
      intent: {
        amount: "0.1",
        selectedTokenAddress: "0x0000000000000000000000000000000000000002",
      },
    });

    expect(view).toBeNull();
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

  it("allows withdrawal while reporting unavailable projected risk", () => {
    const unavailableSupplyBalances = context.position.balances.supply.map(
      (supplyBalance) => ({
        ...supplyBalance,
        balanceUsd: 0,
      })
    );
    const unavailableContext = {
      ...context,
      position: makePosition({
        market: context.position.market,
        snapshot: {
          ...accountPositionDto,
          totalCollateralUsd: 0,
          totalSuppliedUsd: 0,
          supplyBalances: unavailableSupplyBalances,
        },
      }),
    };
    const view = resolveBorrowWithdrawFormView({
      address,
      context: unavailableContext,
      intent: {
        amount: "0.1",
        selectedTokenAddress: context.tokens[0]!.action.args.tokenAddress,
      },
    });

    expect(view?.canSubmit).toBe(true);
    expect(view?.projectedLtv).toBeNull();
    expect(view?.riskStatus).toBe("unavailable");
    expect(view?.reviewState?.summary).toMatchObject({
      riskStatus: "unavailable",
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

  it("validates withdrawal against the collateral composition remaining afterward", () => {
    const highLimitTokenAddress = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    const mixedMarketDto = {
      ...marketDto,
      collateralTokens: [
        {
          ...marketDto.collateralTokens[0],
          liquidationThreshold: "0.6",
          maxLtv: "0.5",
        },
        {
          ...marketDto.collateralTokens[0],
          liquidationThreshold: "0.9",
          maxLtv: "0.8",
          priceUsd: "1000",
          token: {
            address: highLimitTokenAddress,
            decimals: 8,
            name: "Wrapped BTC",
            symbol: "WBTC",
          },
        },
      ],
    } as const;
    const mixedMarket = Schema.decodeUnknownSync(Market)(mixedMarketDto);
    const withdrawAction = {
      args: {
        amountRaw: "100000000",
        marketId: mixedMarket.id,
        tokenAddress: highLimitTokenAddress,
      },
      label: "Withdraw",
      type: "withdraw",
    } as const;
    const position = makePosition({
      market: mixedMarket,
      snapshot: Schema.decodeUnknownSync(BorrowAccountSnapshot)({
        ...Schema.encodeSync(BorrowAccountSnapshot)(accountPositionDto),
        availableToBorrowUsd: "700",
        currentLtv: "0.3",
        debtBalances: [
          {
            apy: "0.06",
            balance: "600",
            balanceRaw: "600000000",
            balanceUsd: "600",
            marketId: mixedMarket.id,
            pendingActions: [],
            tokenAddress: loanTokenAddress,
            tokenSymbol: "USDC",
          },
        ],
        healthFactor: "2.5",
        supplyBalances: [
          {
            apy: "0.02",
            balance: "0.5",
            balanceRaw: "500000000000000000",
            balanceUsd: "1000",
            isCollateral: true,
            marketId: mixedMarket.id,
            pendingActions: [],
            tokenAddress: collateralTokenAddress,
            tokenSymbol: "WETH",
          },
          {
            apy: "0.02",
            balance: "1",
            balanceRaw: "100000000",
            balanceUsd: "1000",
            isCollateral: true,
            marketId: mixedMarket.id,
            pendingActions: [withdrawAction],
            tokenAddress: highLimitTokenAddress,
            tokenSymbol: "WBTC",
          },
        ],
        totalBorrowedUsd: "600",
        totalCollateralUsd: "2000",
        totalSuppliedUsd: "2000",
      }),
    });
    const decodedWithdrawAction = position.actions.supply[0];

    if (decodedWithdrawAction?.type !== "withdraw") {
      throw new Error("Expected withdraw action");
    }

    const selectedToken = {
      action: decodedWithdrawAction,
      collateralToken: mixedMarket.collateralTokens[1]!,
      supplyBalance: position.balances.supply[1]!,
    };
    const mixedContext = {
      position,
      tokens: [selectedToken],
      type: "withdraw",
    } as const;

    const view = resolveBorrowWithdrawFormView({
      address,
      context: mixedContext,
      intent: {
        amount: "1",
        selectedTokenAddress: decodedWithdrawAction.args.tokenAddress,
      },
    });

    expect(view?.projectedLtv).toBe(0.6);
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
  it("blocks disabling collateral when it would exceed borrow capacity", () => {
    const context = getActionContext("disableCollateral");

    if (context.type !== "disableCollateral") {
      throw new Error("Expected disable collateral context");
    }

    const view = resolveBorrowCollateralToggleFormView({
      address,
      context,
    });

    expect(view.reviewState).toBeNull();
    expect(view.riskStatus).toBe("available");
  });
});
