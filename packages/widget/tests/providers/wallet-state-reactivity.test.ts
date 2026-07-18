import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  currentWalletLedgerStateAtom,
  currentWalletStateAtom,
  currentWalletStateResultAtom,
  walletStateAtom,
} from "../../src/features/wallet";
import { walletLedgerStateAtom } from "../../src/features/wallet/runtime/root-atom";
import { disconnectedLedgerConnectorState } from "../../src/features/wallet/state/ledger";
import { disconnectedNormalizedWalletState } from "../../src/features/wallet/state/wallet";
import {
  type WalletInitializationKey,
  walletInitializationKeyAtom,
} from "../../src/features/wallet/wagmi/initialization";

describe("wallet state reactivity", () => {
  it("adapts every legacy topology key to the same read-only service projection", () => {
    const initializationKey = {} as WalletInitializationKey;
    const replacementKey = {} as WalletInitializationKey;
    const walletResult = AsyncResult.success(disconnectedNormalizedWalletState);
    const ledgerResult = AsyncResult.success(disconnectedLedgerConnectorState);
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(walletInitializationKeyAtom, initializationKey),
        Atom.initialValue(walletStateAtom(initializationKey), walletResult),
        Atom.initialValue(
          walletLedgerStateAtom(initializationKey),
          ledgerResult
        ),
      ],
    });

    expect(registry.get(currentWalletStateResultAtom)).toBe(walletResult);
    expect(registry.get(currentWalletStateAtom)).toBe(
      disconnectedNormalizedWalletState
    );
    expect(
      AsyncResult.getOrThrow(registry.get(currentWalletLedgerStateAtom))
    ).toEqual(disconnectedLedgerConnectorState);
    expect(walletStateAtom(initializationKey)).toBe(
      walletStateAtom(replacementKey)
    );
    expect(walletLedgerStateAtom(initializationKey)).toBe(
      walletLedgerStateAtom(replacementKey)
    );
  });
});
