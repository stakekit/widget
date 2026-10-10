import { describe, expect, it } from "@effect/vitest";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { Effect } from "effect";
import type { Connector } from "wagmi";
import { getSolanaConnectors } from "../../../src/services/wallet/internal/adapters/solana/solana-connector";
import {
  makeDefaultHeadlessSolanaRuntime,
  type SolanaWalletDescriptor,
} from "../../../src/services/wallet/internal/runtime/solana-runtime";
import { WalletNotAvailableError } from "../../../src/services/wallet/wallet-errors";
import { runWalletEffect } from "../../utils/run-wallet-effect";
import { unusedWalletConnectProtocol } from "../../utils/wallet-connect";

/** Phantom's injected Solana provider, as the extension exposes it. */
const injectPhantom = () =>
  Object.assign(window, {
    isPhantomInstalled: true,
    phantom: {
      solana: {
        isPhantom: true,
        on: () => undefined,
        off: () => undefined,
        connect: async () => undefined,
      },
    },
  });

const removePhantom = () => {
  Reflect.deleteProperty(window, "phantom");
  Reflect.deleteProperty(window, "isPhantomInstalled");
};

describe("Solana provider presence", () => {
  it.effect(
    "reports Phantom as unavailable once its provider leaves the page",
    () =>
      Effect.gen(function* () {
        injectPhantom();
        const runtime = yield* makeDefaultHeadlessSolanaRuntime({
          walletConnectProtocol: unusedWalletConnectProtocol,
          runWalletEffect,
          includeFallbackAdapters: true,
        });
        // The adapter polls for its provider about once a second.
        const wallets = yield* Effect.callback<
          ReadonlyArray<SolanaWalletDescriptor>
        >((resume) => {
          const check = () => {
            const { wallets } = runtime.getWalletSnapshot();
            const detected = wallets.some(
              ({ adapter }) =>
                adapter.name === "Phantom" &&
                adapter.readyState === WalletReadyState.Installed
            );
            if (detected) resume(Effect.succeed(wallets));
          };
          const unsubscribe = runtime.subscribe(check);
          check();
          return Effect.sync(unsubscribe);
        });
        const phantom = getSolanaConnectors({
          wallets,
          connection: runtime.connection,
          variant: "default",
        })
          .wallets.map((createWallet) => createWallet({} as never))
          .find((wallet) => wallet.id === "Phantom");
        if (phantom?.availability._tag !== "Injected") {
          return yield* Effect.die("Expected Phantom as an injected wallet");
        }
        expect(yield* phantom.availability.detect).toBe(true);

        removePhantom();

        expect(yield* phantom.availability.detect).toBe(false);
        const connector = phantom.createConnector({} as never)({
          emitter: { emit: () => undefined },
          storage: null,
        } as never) as unknown as Connector & {
          connect: () => Promise<unknown>;
        };
        const error = yield* Effect.promise(() =>
          connector.connect().then(
            () => undefined,
            (cause: unknown) => cause
          )
        );
        expect(error).toBeInstanceOf(WalletNotAvailableError);
        expect(error).toMatchObject({ walletId: "Phantom" });
      }).pipe(Effect.ensuring(Effect.sync(removePhantom)), Effect.scoped)
  );
});
