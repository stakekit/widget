import * as Schema from "effect/Schema";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  BorrowAccountPosition,
  deriveBorrowPositionItems,
  Integration,
  Market,
} from "../../src/features/borrow/core";
import {
  getBorrowPositionActions,
  getBorrowPositionDetailsModel,
} from "../../src/features/borrow/ui/position-details-model";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

const marketDto = {
  id: "aave-v3-ethereum-usdc",
  integrationId: "aave-borrow",
  network: "ethereum",
  type: "pool",
  poolAddress: "0x0000000000000000000000000000000000000001",
  loanToken: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  collateralTokens: [
    {
      token: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
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

const positionDto = Schema.decodeUnknownSync(BorrowAccountPosition)({
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
          args: {
            marketId: marketDto.id,
            tokenAddress: marketDto.loanToken.address,
          },
          label: "Repay",
          type: "repay",
        },
      ],
      tokenAddress: marketDto.loanToken.address,
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
            tokenAddress: marketDto.collateralTokens[0].token.address,
          },
          label: "Withdraw",
          type: "withdraw",
        },
        {
          args: {
            marketId: marketDto.id,
            tokenAddress: marketDto.collateralTokens[0].token.address,
          },
          label: "Disable collateral",
          type: "disableCollateral",
        },
      ],
      tokenAddress: marketDto.collateralTokens[0].token.address,
      tokenSymbol: "WETH",
    },
  ],
  totalBorrowedUsd: "400",
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
});

const t = ((key: string) => key) as TFunction;

describe("borrow position items", () => {
  it("projects integration-level position responses into market positions", () => {
    const [position] = deriveBorrowPositionItems({
      integrationPositions: [
        {
          integration: Schema.decodeUnknownSync(Integration)(integrationDto),
          position: positionDto,
        },
      ],
      markets: [Schema.decodeUnknownSync(Market)(marketDto)],
    });

    expect(position?.id).toBe("aave-v3-ethereum-usdc");
    expect(position?.debtBalance?.balance).toBe(400);
    expect(position?.supplyBalances).toHaveLength(1);
    expect(position?.getCurrentLtv()).toBe(0.4);
    expect(position?.getHealthFactor()).toBe(2.125);
  });

  it("builds review states for borrow position pending actions", () => {
    const [position] = deriveBorrowPositionItems({
      integrationPositions: [
        {
          integration: Schema.decodeUnknownSync(Integration)(integrationDto),
          position: positionDto,
        },
      ],
      markets: [Schema.decodeUnknownSync(Market)(marketDto)],
    });

    if (!position) {
      throw new Error("Expected borrow position");
    }

    const actions = getBorrowPositionActions({ address, position, t });

    expect(actions.map((action) => action.reviewState.request.action)).toEqual([
      "repay",
      "withdraw",
      "disableCollateral",
    ]);
    expect(actions[0]?.reviewState.request.args).toMatchObject({
      repayAll: true,
    });
    expect(actions[0]?.pendingContext.type).toBe("repay");
    expect(actions[1]?.reviewState.request.args).toMatchObject({
      amount: "0.5",
    });
    expect(actions[1]?.pendingContext.type).toBe("withdraw");
    expect(actions[2]?.pendingContext.type).toBe("disableCollateral");
  });

  it("derives borrow position details model from local position data", () => {
    const [position] = deriveBorrowPositionItems({
      integrationPositions: [
        {
          integration: Schema.decodeUnknownSync(Integration)(integrationDto),
          position: positionDto,
        },
      ],
      markets: [Schema.decodeUnknownSync(Market)(marketDto)],
    });

    if (!position) {
      throw new Error("Expected borrow position");
    }

    const model = getBorrowPositionDetailsModel({ position, t });

    expect(model.title).toBe("WETH/USDC");
    expect(model.providerName).toBe("Aave V3");
    expect(model.metricCards.map((card) => card.id)).toEqual([
      "net-worth",
      "debt",
      "ltv",
      "health-factor",
    ]);
    expect(model.breakdownRows.map((row) => row.id)).toEqual([
      `supply-${marketDto.collateralTokens[0].token.address.toLowerCase()}`,
      `debt-${marketDto.loanToken.address.toLowerCase()}`,
    ]);
    expect(model.detailRows.map((row) => row.id)).toContain("net-apy");
    expect(model.currentLtv).toBe(0.4);
    expect(model.healthFactor).toBe(2.125);
    expect(model.liquidationThreshold).toBe(0.85);
    expect(model.collateralItems).toEqual([
      expect.objectContaining({
        isCollateral: true,
        label: "WETH",
      }),
    ]);
  });
});
