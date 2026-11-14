import { Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { vi } from "vitest";

import {
  ConfidentialHandle,
  type EarnBalance,
  EarnPosition,
} from "../../src/domain/earn/balance";
import { exactDecimal } from "../../src/domain/finance/exact";
import { Prices } from "../../src/domain/finance/prices";
import { appRuntime } from "../../src/runtime/app-runtime";
import type { YieldResourceSource } from "../../src/services/api/resource-sources";
import { RevealedBalances } from "../../src/services/zama/revealed-balances";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../fixtures";
import {
  legacyResourceSourceLayer,
  yieldResourceSourceLayer,
} from "./services/resource-sources";

/** A yield in ETH (18 decimals) priced at 4 USD. */
const revealedYield = yieldApiYieldFixture();

export const encryptedHandle = Schema.decodeSync(ConfidentialHandle)(
  `0x${"c3".repeat(32)}`
);

/** A position whose one balance hides its shares behind `encryptedHandle`. */
export const encryptedPosition: EarnPosition = Schema.decodeSync(EarnPosition)({
  balances: [
    yieldBalanceFixture({
      amount: "0",
      amountRaw: "0",
      amountUsd: "0",
      isEncrypted: true,
      shareAmountRaw: encryptedHandle,
      token: revealedYield.token,
    }),
  ],
  outputTokenBalance: null,
  yieldId: revealedYield.id,
});

/** The registry's Revealed Balances, to reveal or forget handles. */
export const revealedBalancesServiceAtom = appRuntime.atom(RevealedBalances);

/** Reveals `encryptedHandle` as 2.5 shares (18 decimals) in the registry. */
export const revealBalance = (registry: AtomRegistry.AtomRegistry) =>
  AsyncResult.getOrThrow(registry.get(revealedBalancesServiceAtom))
    .addHandles([[encryptedHandle, 2_500_000_000_000_000_000n]])
    .pipe(Effect.andThen(Effect.yieldNow));

/** A balance's shown amounts, decimals as strings. */
export const balanceView = (balance: EarnBalance | undefined) => ({
  amount: balance?.amount.toFixed(),
  amountRaw: balance?.amountRaw,
  amountUsd: balance?.amountUsd?.toFixed(),
  isEncrypted: balance?.isEncrypted,
  shares:
    balance?.shares?._tag === "Revealed"
      ? { ...balance.shares, amount: balance.shares.amount.toFixed() }
      : balance?.shares,
});

export const encryptedBalanceView = {
  amount: "0",
  amountRaw: 0n,
  amountUsd: "0",
  isEncrypted: true,
  shares: { _tag: "Encrypted", handle: encryptedHandle },
};

/** `encryptedPosition`'s balance once revealed: 2.5 ETH at 4 USD. */
export const revealedBalanceView = {
  amount: "2.5",
  amountRaw: 2_500_000_000_000_000_000n,
  amountUsd: "10",
  isEncrypted: undefined,
  shares: {
    _tag: "Revealed",
    amount: "2.5",
    amountRaw: 2_500_000_000_000_000_000n,
    handle: encryptedHandle,
  },
};

/**
 * A registry whose Application Runtime reads the given Yield API sources,
 * serves the revealed yield and its 4 USD price, keeps Revealed Balances, and
 * shares one Reactivity for invalidation.
 */
export const makeRevealingRegistry = (
  sources: Partial<YieldResourceSource["Service"]>
) => {
  const getOpportunity = vi.fn(() => Effect.succeed(revealedYield));
  const getPrices = vi.fn(() =>
    Effect.succeed(
      new Prices(
        new Map([
          [
            `${revealedYield.token.network}-`,
            { price: exactDecimal(4), price24H: undefined },
          ],
        ])
      )
    )
  );
  const registry = AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Reactivity.layer,
          RevealedBalances.layer,
          yieldResourceSourceLayer({ getOpportunity, ...sources }),
          legacyResourceSourceLayer({ getPrices })
        ) as never
      ),
    ],
  });

  return { getOpportunity, getPrices, registry };
};
