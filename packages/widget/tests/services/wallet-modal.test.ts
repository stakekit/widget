import { Effect } from "effect";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { runAddLedgerAccount } from "../../src/features/wallet/state/workflows";
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

  it("closes the chain modal after Ledger switches account", async () => {
    const closeChain = vi.fn();
    const owner = {};
    const program = Effect.gen(function* () {
      const modal = yield* WalletModal;
      yield* modal.install(owner, {
        closeChain,
        openConnect: vi.fn(),
      });
      yield* runAddLedgerAccount({
        chain: mainnet,
        connector: {
          requestAndSwitchAccount: () => Effect.succeed(mainnet),
        },
      });
    });

    await Effect.runPromise(program.pipe(Effect.provide(WalletModal.layer)));

    expect(closeChain).toHaveBeenCalledOnce();
  });

  it("retains a typed failure when the Ledger connector is missing", async () => {
    const error = await Effect.runPromise(
      runAddLedgerAccount({
        chain: mainnet,
        connector: null,
      }).pipe(Effect.provide(WalletModal.layer), Effect.flip)
    );

    expect(error).toMatchObject({
      _tag: "WalletIntegrationError",
      operation: "ledger-add-account",
    });
  });
});
