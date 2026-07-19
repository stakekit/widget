import { Effect, Logger, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Action } from "../../src/domain/borrow/action";
import { Integration } from "../../src/domain/borrow/integration";
import {
  BorrowIntegrationPositionsResponse,
  BorrowIntegrationsResponse,
  BorrowMarketsResponse,
} from "../../src/domain/borrow/responses";

const address = "0x0000000000000000000000000000000000000001";

const integration = {
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

const market = {
  id: "aave-v3-ethereum-usdc",
  integrationId: "aave-borrow",
  network: "ethereum",
  type: "pool",
  poolAddress: address,
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

const supplyBalance = {
  apy: "0.02",
  balance: "0.5",
  balanceRaw: "500000000000000000",
  balanceUsd: "1000",
  isCollateral: true,
  marketId: market.id,
  pendingActions: [],
  tokenAddress: market.collateralTokens[0].token.address,
  tokenSymbol: "WETH",
} as const;

const accountPosition = {
  address,
  availableToBorrowUsd: "450",
  currentLtv: "0.4",
  debtBalances: [],
  healthFactor: "2.125",
  integrationId: integration.id,
  netApy: "0.02",
  netWorthUsd: "1000",
  network: "ethereum",
  supplyBalances: [supplyBalance],
  totalBorrowedUsd: "0",
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
} as const;

const transaction = {
  address,
  chainId: "1",
  id: "transaction-1",
  network: "ethereum",
  status: "CREATED",
  type: "BORROW",
} as const;

const action = {
  id: "action-1",
  integrationId: integration.id,
  action: "borrow",
  address,
  status: "CREATED",
  transactions: [transaction],
  hasNextStep: false,
  currentStep: 1,
  totalSteps: 1,
  createdAt: "2026-07-10T12:00:00.000Z",
} as const;

const decode = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown
) =>
  Effect.runPromise(
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.provide(Logger.layer([]))
    )
  );

describe("Borrow API boundary policies", () => {
  it("omits an invalid integration while retaining valid siblings", async () => {
    const result = await decode(BorrowIntegrationsResponse, [
      integration,
      { ...integration, id: "invalid-integration", name: 1 },
    ]);

    expect(result.map((item) => item.id)).toEqual([integration.id]);
  });

  it("omits a complete market when a nested token fails", async () => {
    const result = await decode(BorrowMarketsResponse, {
      items: [
        market,
        {
          ...market,
          id: "invalid-market",
          loanToken: { ...market.loanToken, decimals: "6" },
        },
      ],
      limit: 100,
      offset: 0,
      total: 2,
    });

    expect(result.items?.map((item) => item.id)).toEqual([market.id]);
    expect(result.total).toBe(2);
  });

  it("omits an invalid complete position entry", async () => {
    const decodedIntegration =
      Schema.decodeUnknownSync(Integration)(integration);
    const result = await decode(BorrowIntegrationPositionsResponse, [
      { integration: decodedIntegration, position: accountPosition },
      {
        integration: decodedIntegration,
        position: { ...accountPosition, address: "invalid-address" },
      },
    ]);

    expect(result).toHaveLength(1);
  });

  it("rejects the complete position instead of salvaging valid balance siblings", async () => {
    const decodedIntegration =
      Schema.decodeUnknownSync(Integration)(integration);
    const result = await decode(BorrowIntegrationPositionsResponse, [
      {
        integration: decodedIntegration,
        position: {
          ...accountPosition,
          supplyBalances: [
            supplyBalance,
            { ...supplyBalance, tokenSymbol: "INVALID", balance: "NaN" },
          ],
        },
      },
    ]);

    expect(result).toEqual([]);
  });

  it("strictly rejects malformed single actions", async () => {
    await expect(
      decode(Action, { ...action, currentStep: "1" })
    ).rejects.toThrow(/Expected number/);
  });

  it("strictly rejects an action containing a malformed transaction", async () => {
    await expect(
      decode(Action, {
        ...action,
        transactions: [{ ...transaction, chainId: "not-a-number" }],
      })
    ).rejects.toThrow();
  });
});
