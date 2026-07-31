import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { WalletModal } from "../../src/services/wallet/wallet-modal";

describe("WalletModal", () => {
  it("keeps modal callbacks runtime-scoped and owner-released", async () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const firstOwner = {};
    const secondOwner = {};
    const program = Effect.gen(function* () {
      const modal = yield* WalletModal;

      yield* modal.install(firstOwner, {
        closeChain: firstClose,
        openConnect: vi.fn(),
      });
      yield* modal.install(secondOwner, {
        closeChain: secondClose,
        openConnect: vi.fn(),
      });
      yield* modal.uninstall(firstOwner);
      yield* modal.closeChain;
      yield* modal.uninstall(secondOwner);
      yield* modal.closeChain;
    });

    await Effect.runPromise(program.pipe(Effect.provide(WalletModal.layer)));

    expect(firstClose).not.toHaveBeenCalled();
    expect(secondClose).toHaveBeenCalledOnce();
  });
});
