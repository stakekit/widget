import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import type { Connector } from "wagmi";
import { getStellarConnectors } from "../../../src/services/wallet/internal/adapters/stellar/stellar-connector";
import {
  makeDirectStellarWalletClient,
  makeWalletConnectStellarWalletClient,
  type StellarWalletModule,
} from "../../../src/services/wallet/internal/platform/stellar-wallets-kit-platform";
import type { WalletDescriptor } from "../../../src/services/wallet/wallet-descriptors";
import { WalletNotAvailableError } from "../../../src/services/wallet/wallet-errors";
import { runWalletEffect } from "../../utils/run-wallet-effect";
import { unusedWalletConnectProtocol } from "../../utils/wallet-connect";

const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/** A Stellar Wallets Kit module whose extension the test installs and removes. */
const makeModule = (name: string) => {
  const extension = { present: false, checks: 0 };
  const module: StellarWalletModule = {
    getAddress: async () => ({ address }),
    getNetwork: async () => ({
      network: "PUBLIC",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    }),
    isAvailable: async () => {
      extension.checks += 1;
      return extension.present;
    },
    productIcon: `https://example.com/${name}.png`,
    productId: name,
    productName: name,
    signTransaction: async () => ({ signedTxXdr: "signed-xdr" }),
  };
  return { extension, module };
};

const makeWallets = Effect.fn("makeStellarWallets")(function* () {
  const freighter = makeModule("Freighter");
  const lobstr = makeModule("LOBSTR");
  const walletConnect = yield* makeWalletConnectStellarWalletClient(
    unusedWalletConnectProtocol
  );
  const wallets = getStellarConnectors({
    clients: [
      makeDirectStellarWalletClient({
        id: "freighter",
        module: freighter.module,
        validateMainnet: true,
      }),
      makeDirectStellarWalletClient({
        id: "albedo",
        module: makeModule("Albedo").module,
        validateMainnet: false,
      }),
      makeDirectStellarWalletClient({
        id: "xbull",
        module: makeModule("xBull").module,
        validateMainnet: false,
      }),
      makeDirectStellarWalletClient({
        id: "lobstr",
        module: lobstr.module,
        validateMainnet: false,
      }),
      walletConnect,
    ],
    runWalletEffect,
  }).wallets.map((createWallet) => createWallet({} as never));
  const byId = (id: string): WalletDescriptor => {
    const wallet = wallets.find((candidate) => candidate.id === id);
    if (!wallet) throw new Error(`Stellar wallet ${id} missing`);
    return wallet;
  };
  return { byId, freighter, lobstr };
});

const detect = (wallet: WalletDescriptor) =>
  wallet.availability._tag === "Injected"
    ? wallet.availability.detect
    : Effect.die(`${wallet.id} is not an injected wallet`);

describe("Stellar wallet availability", () => {
  it.effect("offers extension wallets with their store pages", () =>
    Effect.gen(function* () {
      const { byId } = yield* makeWallets();

      expect(byId("freighter").availability).toMatchObject({
        _tag: "Injected",
        installUrl:
          "https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk",
      });
      expect(byId("lobstr").availability).toMatchObject({
        _tag: "Injected",
        installUrl:
          "https://chromewebstore.google.com/detail/lobstr/ldiagbjmlmjiieclmdkagofdjcgodjle",
      });
      expect(byId("albedo").availability).toEqual({ _tag: "Remote" });
      expect(byId("xbull").availability).toEqual({ _tag: "Remote" });
      expect(byId("stellar-wallet-connect").availability).toEqual({
        _tag: "Remote",
      });
    }).pipe(Effect.scoped)
  );

  it.effect("asks the module whether its extension is present each time", () =>
    Effect.gen(function* () {
      const { byId, freighter, lobstr } = yield* makeWallets();
      lobstr.extension.present = true;

      expect(yield* detect(byId("freighter"))).toBe(false);
      expect(yield* detect(byId("lobstr"))).toBe(true);

      freighter.extension.present = true;

      expect(yield* detect(byId("freighter"))).toBe(true);
    }).pipe(Effect.scoped)
  );

  it.effect(
    "finds Freighter from its page global without asking the extension",
    () =>
      Effect.gen(function* () {
        const { byId, freighter } = yield* makeWallets();
        yield* Effect.acquireRelease(
          Effect.sync(() => vi.stubGlobal("freighter", true)),
          () => Effect.sync(() => vi.unstubAllGlobals())
        );

        expect(yield* detect(byId("freighter"))).toBe(true);
        expect(freighter.extension.checks).toBe(0);
      }).pipe(Effect.scoped)
  );

  it.effect(
    "reports the wallet as unavailable when the extension is gone at connect",
    () =>
      Effect.gen(function* () {
        const { byId } = yield* makeWallets();
        const connector = byId("freighter").createConnector({} as never)({
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
        expect(error).toMatchObject({ walletId: "freighter" });
      }).pipe(Effect.scoped)
  );
});
