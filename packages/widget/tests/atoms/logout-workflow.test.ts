import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { actionHistoryRevisionAtom } from "../../src/features/classic-transaction-flow/state";
import { runLogout } from "../../src/features/wallet/state/workflows";
import { disconnectWidgetAtom } from "../../src/features/widget-shell/state";
import { WalletConnectionError } from "../../src/services/wallet/domain/errors";
import { WalletModal } from "../../src/services/wallet/wallet-modal";
import { WalletService } from "../../src/services/wallet/wallet-service";

describe("logout workflow", () => {
  it("disconnects before clearing databases", async () => {
    const events: string[] = [];

    await Effect.runPromise(
      runLogout({
        clearDatabases: async () => {
          events.push("clear-databases");
        },
        disconnect: Effect.sync(() => {
          events.push("disconnect");
          return { connectorId: "test" };
        }),
      })
    );

    expect(events).toEqual(["disconnect", "clear-databases"]);
  });

  it("does not clear storage and fails when disconnect fails", async () => {
    const clearDatabases = vi.fn(async () => undefined);

    await expect(
      Effect.runPromise(
        runLogout({
          clearDatabases,
          disconnect: Effect.fail(
            new WalletConnectionError({
              cause: new Error("rejected"),
              operation: "disconnect",
            })
          ),
        })
      )
    ).rejects.toMatchObject({ _tag: "WalletConnectionError" });

    expect(clearDatabases).not.toHaveBeenCalled();
  });

  it("resets action history only after the Widget disconnect succeeds", async () => {
    const disconnect = vi.fn(() => Effect.void);
    vi.stubGlobal("indexedDB", {
      databases: async () => [],
    });
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          walletRuntime.layer,
          Layer.mergeAll(
            Layer.succeed(
              WalletService,
              WalletService.of({ disconnect } as never)
            ),
            Layer.succeed(
              WalletModal,
              WalletModal.of({
                closeChain: Effect.void,
                install: () => Effect.void,
                openConnect: Effect.void,
                uninstall: () => Effect.void,
              })
            )
          ) as never
        ),
        Atom.initialValue(actionHistoryRevisionAtom, 4),
      ],
    });

    try {
      registry.set(disconnectWidgetAtom, undefined);

      await vi.waitFor(() => expect(disconnect).toHaveBeenCalledOnce());
      await vi.waitFor(() =>
        expect(registry.get(actionHistoryRevisionAtom)).toBe(0)
      );
    } finally {
      registry.dispose();
      vi.unstubAllGlobals();
    }
  });
});
