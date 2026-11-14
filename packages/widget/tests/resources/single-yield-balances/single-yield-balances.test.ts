import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { AsyncResult } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";

import type { EarnYieldBalancesResponse } from "../../../src/domain/earn/responses";
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../../src/domain/wallet/wallet-scope";
import {
  SingleYieldBalancesKey,
  singleYieldBalancesResourceAtom,
} from "../../../src/resources/single-yield-balances/single-yield-balances";
import { appRuntime } from "../../../src/runtime/app-runtime";
import { resourceInvalidationKeys } from "../../../src/services/resource-invalidation";
import {
  balanceView,
  encryptedPosition,
  makeRevealingRegistry,
  revealBalance,
  revealedBalanceView,
} from "../../utils/revealed-balances";

const firstWallet = WalletAddress.make(
  "0x00000000000000000000000000000000000000a1"
);
const secondWallet = WalletAddress.make(
  "0x00000000000000000000000000000000000000b2"
);
const otherYield = YieldId.make("ethereum-eth-lido-staking");

const walletScope = (address: WalletAddress) =>
  new WalletScopeKey({ address, network: "ethereum" });

const balancesKey = (
  address: WalletAddress,
  yieldId = encryptedPosition.yieldId
) => new SingleYieldBalancesKey({ scope: walletScope(address), yieldId });

const makeSource = () =>
  vi.fn(
    (_request: {
      readonly address: WalletAddress;
      readonly yieldId: YieldId;
    }): Effect.Effect<EarnYieldBalancesResponse> =>
      Effect.succeed(encryptedPosition)
  );

const reactivityAtom = appRuntime.atom(Reactivity.Reactivity);

describe("Single Yield Balances resource", () => {
  it.effect(
    "shares one read per wallet and yield and reads another wallet or yield on its own",
    () =>
      Effect.gen(function* () {
        const getSingleYieldBalances = makeSource();
        const { registry } = makeRevealingRegistry({ getSingleYieldBalances });
        yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
        const read = (key: SingleYieldBalancesKey) => {
          registry.mount(singleYieldBalancesResourceAtom(key));
          return registry.get(singleYieldBalancesResourceAtom(key));
        };

        const first = read(balancesKey(firstWallet));
        const again = read(balancesKey(firstWallet));
        read(balancesKey(secondWallet));
        read(balancesKey(firstWallet, otherYield));

        expect(AsyncResult.isSuccess(first)).toBe(true);
        expect(again).toBe(first);
        expect(getSingleYieldBalances.mock.calls).toEqual([
          [
            {
              address: "0x00000000000000000000000000000000000000a1",
              yieldId: "ethereum-eth-native-staking",
            },
          ],
          [
            {
              address: "0x00000000000000000000000000000000000000b2",
              yieldId: "ethereum-eth-native-staking",
            },
          ],
          [
            {
              address: "0x00000000000000000000000000000000000000a1",
              yieldId: "ethereum-eth-lido-staking",
            },
          ],
        ]);
      })
  );

  it.effect("reads a wallet's balances again when they are invalidated", () =>
    Effect.gen(function* () {
      const getSingleYieldBalances = makeSource();
      const { registry } = makeRevealingRegistry({ getSingleYieldBalances });
      yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
      registry.mount(singleYieldBalancesResourceAtom(balancesKey(firstWallet)));
      registry.mount(
        singleYieldBalancesResourceAtom(balancesKey(secondWallet))
      );
      registry.mount(reactivityAtom);
      const reactivity = AsyncResult.getOrThrow(registry.get(reactivityAtom));

      yield* reactivity.invalidate(
        resourceInvalidationKeys.singleYieldBalances(walletScope(secondWallet))
      );

      expect(
        getSingleYieldBalances.mock.calls.map(([request]) => request.address)
      ).toEqual([
        "0x00000000000000000000000000000000000000a1",
        "0x00000000000000000000000000000000000000b2",
        "0x00000000000000000000000000000000000000b2",
      ]);
    })
  );

  it.effect(
    "shares one read across an EVM wallet's address casing and reads it again when its owner is invalidated",
    () =>
      Effect.gen(function* () {
        const checksummed = WalletAddress.make(
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        );
        const lowercase = WalletAddress.make(
          "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
        );
        const getSingleYieldBalances = makeSource();
        const { registry } = makeRevealingRegistry({ getSingleYieldBalances });
        yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
        registry.mount(
          singleYieldBalancesResourceAtom(balancesKey(checksummed))
        );
        registry.mount(singleYieldBalancesResourceAtom(balancesKey(lowercase)));
        registry.mount(reactivityAtom);
        const reactivity = AsyncResult.getOrThrow(registry.get(reactivityAtom));

        // As a finished Transaction Workflow does, for its lowercased owner.
        yield* reactivity.invalidate(
          resourceInvalidationKeys.singleYieldBalances(
            walletScopeOwnerKey(walletScope(checksummed))
          )
        );

        expect(
          getSingleYieldBalances.mock.calls.map(([request]) => request.address)
        ).toEqual([
          "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        ]);
      })
  );

  it.effect("shows a revealed balance in place of the encrypted one", () =>
    Effect.gen(function* () {
      const getSingleYieldBalances = makeSource();
      const { registry } = makeRevealingRegistry({ getSingleYieldBalances });
      yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
      const resource = singleYieldBalancesResourceAtom(
        balancesKey(firstWallet)
      );
      registry.mount(resource);

      yield* revealBalance(registry);

      expect(
        balanceView(AsyncResult.getOrThrow(registry.get(resource)).balances[0])
      ).toEqual(revealedBalanceView);
      expect(getSingleYieldBalances).toHaveBeenCalledOnce();
    })
  );
});
