import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import type { Market } from "../../../src/domain/borrow/catalog/market";
import { MarketId } from "../../../src/domain/borrow/ids";
import { exactDecimal } from "../../../src/domain/finance/exact";
import { borrowFlowDetailsAtom } from "../../../src/features/borrow/borrow-entry/state/flow-details";
import { widgetConfigAtom } from "../../../src/features/widget-configuration/index";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom,
} from "../../../src/resources/borrow-markets/index";
import { BorrowResourceSource } from "../../../src/services/api/resource-sources";
import {
  borrowEntryFlowDetails,
  borrowEntryFlowMarket,
} from "../../utils/borrow-flow-entry";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const makeRegistry = (markets: ReadonlyArray<Market>) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(BorrowResourceSource, {
          getIntegrations: Effect.succeed([]),
          getMarkets: () =>
            Effect.succeed({
              items: markets,
              limit: 100,
              offset: 0,
              total: markets.length,
            }),
          getPositionData: () => Effect.succeed([]),
        } as never) as never
      ),
      applicationRuntimeInitInitialValue({
        apiKey: "api-key",
        borrowEnabled: true,
        dashboardVariant: true,
        variant: "default",
      }),
    ],
  });

/** Resolves the flow details once the market catalog has loaded. */
const resolveFlowDetails = (markets: ReadonlyArray<Market>) =>
  Effect.promise(async () => {
    const registry = makeRegistry(markets);
    const details = borrowFlowDetailsAtom(borrowEntryFlowDetails);
    registry.mount(details);
    await vi.waitFor(() => {
      const catalog = registry.get(
        borrowMarketsResourceAtom.foreground(
          new BorrowMarketsKey({
            network: borrowEntryFlowMarket.network,
            scope: registry.get(widgetConfigAtom).borrowMarketsScope,
          })
        )
      );
      expect(AsyncResult.isSuccess(catalog) && !catalog.waiting).toBe(true);
    });
    return registry.get(details);
  });

describe("Borrow Entry flow details", () => {
  it.effect("follows the live catalog entry of the captured market", () =>
    Effect.gen(function* () {
      const live = {
        ...borrowEntryFlowMarket,
        availableLiquidity: exactDecimal("1"),
      };

      const details = yield* resolveFlowDetails([live]);

      expect(details.market.availableLiquidity.toString()).toBe("1");
    })
  );

  it.effect("keeps the captured market when the catalog no longer has it", () =>
    Effect.gen(function* () {
      // Another market stays listed, so a first-market fallback would show.
      const otherMarket = {
        ...borrowEntryFlowMarket,
        id: MarketId.make("morpho-blue-borrow-base-weth-usdc-1"),
      };

      const details = yield* resolveFlowDetails([otherMarket]);

      expect(details.market).toBe(borrowEntryFlowMarket);
      expect(details.collateralToken).toBe(
        borrowEntryFlowDetails.collateralToken
      );
    })
  );

  it.effect("keeps the captured collateral when the live market drops it", () =>
    Effect.gen(function* () {
      const live = { ...borrowEntryFlowMarket, collateralTokens: [] };

      const details = yield* resolveFlowDetails([live]);

      expect(details.market.collateralTokens).toEqual([]);
      expect(details.collateralToken).toBe(
        borrowEntryFlowDetails.collateralToken
      );
    })
  );
});
