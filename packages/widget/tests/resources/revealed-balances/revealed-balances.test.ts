import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { AsyncResult } from "effect/reactivity";

import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { revealedBalancesAtom } from "../../../src/resources/revealed-balances/revealed-balances";
import { yieldPositionsResourceAtom } from "../../../src/resources/yield-positions/yield-positions";
import {
  balanceView,
  encryptedBalanceView,
  encryptedHandle,
  encryptedPosition,
  makeRevealingRegistry,
  revealBalance,
  revealedBalanceView,
  revealedBalancesServiceAtom,
} from "../../utils/revealed-balances";

const scope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x00000000000000000000000000000000000000a1"
  ),
  network: "ethereum",
});

describe("Revealed Balances", () => {
  it.effect("publishes the revealed handles now and after each reveal", () =>
    Effect.gen(function* () {
      const { registry } = makeRevealingRegistry({});
      yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
      registry.mount(revealedBalancesAtom);
      const handles = () =>
        AsyncResult.getOrThrow(registry.get(revealedBalancesAtom)).handles;
      expect(handles()).toEqual(new Map());

      const revealed = AsyncResult.getOrThrow(
        registry.get(revealedBalancesServiceAtom)
      );
      yield* revealed.addHandles([[encryptedHandle, 7n]]);
      yield* Effect.yieldNow;

      expect(handles()).toEqual(new Map([[encryptedHandle, 7n]]));
    })
  );

  it.effect(
    "replaces a revealed encrypted balance in positions until its handle is forgotten",
    () =>
      Effect.gen(function* () {
        const getPositions = vi.fn(() =>
          Effect.succeed({ errors: [], items: [encryptedPosition] })
        );
        const { getOpportunity, getPrices, registry } = makeRevealingRegistry({
          getPositions,
        });
        yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
        const resource = yieldPositionsResourceAtom(scope);
        registry.mount(resource);
        const balance = () =>
          balanceView(
            AsyncResult.getOrThrow(registry.get(resource)).items[0]?.balances[0]
          );

        expect(balance()).toEqual(encryptedBalanceView);
        // Only a revealed yield is valued.
        expect(getOpportunity).not.toHaveBeenCalled();
        expect(getPrices).not.toHaveBeenCalled();

        yield* revealBalance(registry);

        expect(balance()).toEqual(revealedBalanceView);
        // Revealing reads no positions again.
        expect(getPositions).toHaveBeenCalledOnce();

        yield* AsyncResult.getOrThrow(registry.get(revealedBalancesServiceAtom))
          .forgetHandles;
        yield* Effect.yieldNow;

        expect(balance()).toEqual(encryptedBalanceView);
      })
  );
});
