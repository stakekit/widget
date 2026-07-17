import { Schema } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import { borrowExecutionInputAtom } from "../../src/features/borrow/ui/execution-state";
import type { BorrowExecutionInput } from "../../src/features/borrow/ui/review-state";
import { currentWalletScopeAtom } from "../../src/features/wallet/runtime/selectors";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";

describe("borrow execution state", () => {
  it("resets the execution input when the current wallet scope changes", () => {
    const walletScope = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0x0000000000000000000000000000000000000001"
      ),
      network: "base",
    });
    const registry = AtomRegistry.make({
      initialValues: [[currentWalletScopeAtom, walletScope]],
    });
    const unmount = registry.mount(borrowExecutionInputAtom);
    const executionInput = {} as BorrowExecutionInput;

    registry.set(borrowExecutionInputAtom, executionInput);

    expect(registry.get(borrowExecutionInputAtom)).toBe(executionInput);

    registry.refresh(currentWalletScopeAtom);

    expect(registry.get(borrowExecutionInputAtom)).toBeNull();

    unmount();
    registry.dispose();
  });
});
