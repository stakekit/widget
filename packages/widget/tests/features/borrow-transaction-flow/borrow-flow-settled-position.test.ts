import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { Integration } from "../../../src/domain/borrow/catalog/integration";
import { Market } from "../../../src/domain/borrow/catalog/market";
import { ActionCommand } from "../../../src/domain/borrow/execution/action-command";
import { BorrowAccountSnapshot } from "../../../src/domain/borrow/positions/borrow-account-snapshot";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  BorrowFlowSession,
  type BorrowTransactionFlowReview,
} from "../../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import { makeBorrowFlowSettledPositionAtom } from "../../../src/features/borrow-transaction-flow/state/atoms/borrow-flow-position";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../src/resources/borrow-positions/index";
import {
  ApiRequestError,
  BorrowResourceSource,
} from "../../../src/services/api/resource-sources";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });

const integration = Schema.decodeSync(Integration)({
  id: "aave-borrow",
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  name: "Aave V3",
  networks: ["ethereum"],
});

const weth = {
  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  decimals: 18,
  name: "Wrapped Ether",
  symbol: "WETH",
} as const;

const marketDto = (
  id: string,
  loanToken: (typeof Market.Encoded)["loanToken"]
) =>
  ({
    availableLiquidity: "500000",
    availableLiquidityRaw: "500000000000",
    blueBundleOriginationFeeBps: null,
    borrowRate: "0.06",
    collateralTokens: [
      {
        liquidationPenalty: "0.05",
        liquidationThreshold: "0.85",
        maxLtv: "0.8",
        priceUsd: "2000",
        supplyRate: "0.02",
        token: weth,
      },
    ],
    feeWrapperAddress: null,
    id,
    integrationId: integration.id,
    isBorrowEnabled: true,
    loanToken,
    loanTokenPriceUsd: "1",
    minLoan: null,
    network: "ethereum",
    originationFeeBps: "0",
    originationFeeWrapperAddress: null,
    poolAddress: "0x0000000000000000000000000000000000000001",
    supplyCollateralFeeBps: "0",
    totalBorrow: "500000",
    totalBorrowRaw: "500000000000",
    totalSupply: "1000000",
    totalSupplyRaw: "1000000000000",
    type: "pool",
    utilizationRate: "0.5",
  }) as const;

const usdcMarket = Schema.decodeSync(Market)(
  marketDto("aave-v3-ethereum-usdc", {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  })
);
const wethMarket = Schema.decodeSync(Market)(
  marketDto("aave-v3-ethereum-weth", weth)
);

/** One pooled account: USDC debt backed by WETH collateral. */
const snapshot = ({
  collateralUsd,
  debtUsd,
}: {
  readonly collateralUsd: string;
  readonly debtUsd: string;
}) =>
  Schema.decodeSync(BorrowAccountSnapshot)({
    address,
    availableToBorrowUsd: "0",
    currentLtv: "0.4",
    debtBalances: [
      {
        apy: "0.06",
        balance: debtUsd,
        balanceRaw: "0",
        balanceUsd: debtUsd,
        marketId: usdcMarket.id,
        pendingActions: [],
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        tokenSymbol: "USDC",
      },
    ],
    healthFactor: "2",
    integrationId: integration.id,
    netApy: "0",
    netWorthUsd: "0",
    network: "ethereum",
    supplyBalances: [
      {
        apy: "0.02",
        balance: "1",
        balanceRaw: "1000000000000000000",
        balanceUsd: collateralUsd,
        isCollateral: true,
        marketId: wethMarket.id,
        pendingActions: [],
        tokenAddress: weth.address,
        tokenSymbol: "WETH",
      },
    ],
    totalBorrowedUsd: debtUsd,
    totalCollateralUsd: collateralUsd,
    totalSuppliedUsd: collateralUsd,
  });

const withdrawSession = new BorrowFlowSession({
  intake: {
    riskVerdict: { _tag: "Allow" },
    command: Schema.decodeSync(ActionCommand)({
      action: "withdraw",
      address,
      args: {
        amount: "0.5",
        marketId: wethMarket.id,
        tokenAddress: weth.address,
      },
      integrationId: integration.id,
    }),
    entry: { _tag: "MarketPosition", marketId: usdcMarket.id },
    summary: {
      action: "withdraw",
      collateralAmount: "0.5",
      collateralTokenSymbol: "WETH",
      existingCollateralUsd: "2000",
      marketLabel: "WETH / USDC",
      network: "ethereum",
      projectedCollateralUsd: "1000",
      providerName: "Aave V3",
      riskStatus: "unavailable",
      warnings: [],
    } satisfies BorrowTransactionFlowReview["summary"],
  },
  walletScope,
});

type Account = { current: BorrowAccountSnapshot | "unavailable" };

const makeRegistry = (account: Account) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(BorrowResourceSource, {
          getIntegrations: Effect.succeed([integration]),
          getMarkets: () =>
            Effect.succeed({
              items: [usdcMarket, wethMarket],
              limit: 100,
              offset: 0,
              total: 2,
            }),
          getPositionData: () =>
            Effect.suspend(() =>
              account.current === "unavailable"
                ? Effect.fail(
                    new ApiRequestError({
                      cause: new Error("positions unavailable"),
                      operation: "borrow-positions",
                    })
                  )
                : Effect.succeed([{ integration, position: account.current }])
            ),
        } as never)
      ),
    ],
  });

const positionsAtom = borrowPositionsResourceAtom.foreground(
  new BorrowPositionsKey({ scope: walletScope })
);

const mountSettled = (registry: AtomRegistry.AtomRegistry) => {
  const settledAtom = makeBorrowFlowSettledPositionAtom(withdrawSession);
  registry.mount(settledAtom);
  return () => registry.get(settledAtom);
};

const eventually = (assertion: () => void) =>
  Effect.promise(() => vi.waitFor(assertion));

describe("Borrow flow settled position", () => {
  it.effect(
    "reports the position from a fetch made after the action, not the cache",
    () =>
      Effect.gen(function* () {
        const account: Account = {
          current: snapshot({ collateralUsd: "2000", debtUsd: "400" }),
        };
        const registry = makeRegistry(account);
        registry.mount(positionsAtom);
        account.current = snapshot({ collateralUsd: "1000", debtUsd: "400" });

        const settled = mountSettled(registry);

        yield* eventually(() =>
          expect(settled()).toMatchObject({
            collateralUsd: "1000",
            debtUsd: "400",
          })
        );
        expect(settled()?.positionOpen).toBe(true);
      })
  );

  it.effect(
    "settles pooled collateral reserves through the account they back",
    () =>
      Effect.gen(function* () {
        const settled = mountSettled(
          makeRegistry({
            current: snapshot({ collateralUsd: "1000", debtUsd: "400" }),
          })
        );

        yield* eventually(() =>
          expect(settled()).toMatchObject({
            collateralUsd: "1000",
            debtUsd: "400",
          })
        );
      })
  );

  it.effect(
    "reports the returned-to position closed once its balances are gone",
    () =>
      Effect.gen(function* () {
        const settled = mountSettled(
          makeRegistry({
            current: {
              ...snapshot({ collateralUsd: "0", debtUsd: "0" }),
              debtBalances: [],
              supplyBalances: [],
            },
          })
        );

        yield* eventually(() =>
          expect(settled()).toMatchObject({ positionOpen: false })
        );
      })
  );

  it.effect("settles on a later refresh when the first fetch fails", () =>
    Effect.gen(function* () {
      const account: Account = { current: "unavailable" };
      const registry = makeRegistry(account);
      const settled = mountSettled(registry);

      yield* eventually(() =>
        expect(AsyncResult.isFailure(registry.get(positionsAtom))).toBe(true)
      );
      expect(settled()).toBeNull();

      account.current = snapshot({ collateralUsd: "1000", debtUsd: "400" });
      registry.refresh(positionsAtom);

      yield* eventually(() =>
        expect(settled()).toMatchObject({
          collateralUsd: "1000",
          debtUsd: "400",
        })
      );
    })
  );
});
