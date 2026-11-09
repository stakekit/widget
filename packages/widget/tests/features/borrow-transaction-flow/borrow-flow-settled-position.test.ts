import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

import { ActionCommand } from "../../../src/domain/borrow/action-command";
import type { BorrowAccountSnapshot } from "../../../src/domain/borrow/borrow-account-snapshot";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import type { BorrowTransactionFlowReview } from "../../../src/features/borrow-transaction-flow/model/review";
import { BorrowFlowSession } from "../../../src/features/borrow-transaction-flow/model/session";
import { makeBorrowFlowSettledPositionAtom } from "../../../src/features/borrow-transaction-flow/state/execution-page";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../src/resources/borrow-positions/borrow-positions";
import { appRuntime } from "../../../src/runtime/app-runtime";
import {
  ApiRequestError,
  BorrowResourceSource,
} from "../../../src/services/api/resource-sources";
import {
  borrowWalletAddress,
  makeBorrowAccountSnapshot,
  makeBorrowCollateralTokenDto,
  makeBorrowDebtBalanceDto,
  makeBorrowIntegration,
  makeBorrowMarket,
  makeBorrowSupplyBalanceDto,
  wethTokenAddress,
} from "../../fixtures/borrow";

const address = Schema.decodeSync(WalletAddress)(borrowWalletAddress);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });

const integration = makeBorrowIntegration();
const usdcMarket = makeBorrowMarket();
const wethMarket = makeBorrowMarket({
  id: "aave-v3-ethereum-weth",
  loanToken: makeBorrowCollateralTokenDto().token,
});

/** One pooled account: USDC debt backed by WETH collateral. */
const snapshot = ({
  collateralUsd,
  debtUsd,
}: {
  readonly collateralUsd: string;
  readonly debtUsd: string;
}) =>
  makeBorrowAccountSnapshot({
    availableToBorrowUsd: "0",
    debtBalances: [
      makeBorrowDebtBalanceDto({
        balance: debtUsd,
        balanceUsd: debtUsd,
        marketId: usdcMarket.id,
      }),
    ],
    healthFactor: "2",
    netApy: "0",
    netWorthUsd: "0",
    supplyBalances: [
      makeBorrowSupplyBalanceDto({
        balance: "1",
        balanceRaw: "1000000000000000000",
        balanceUsd: collateralUsd,
        marketId: wethMarket.id,
      }),
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
        tokenAddress: wethTokenAddress,
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
                      failure: { _tag: "Unreachable" },
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
