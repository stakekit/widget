import { describe, expect, it } from "@effect/vitest";
import {
  type Adapter,
  type WalletName,
  WalletNotReadyError,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import { Connection } from "@solana/web3.js";
import { Effect } from "effect";
import type { Connector } from "wagmi";
import { getSolanaConnectors } from "../../../src/services/wallet/internal/adapters/solana/solana-connector";
import type { WalletDescriptor } from "../../../src/services/wallet/wallet-descriptors";
import { WalletNotAvailableError } from "../../../src/services/wallet/wallet-errors";

/** A wallet-adapter whose readyState the test moves, as the SDK does when an extension injects late. */
type FakeSolanaAdapter = {
  readonly name: WalletName;
  readonly icon: string;
  readyState: WalletReadyState;
  readonly connect: () => Promise<void>;
};

const makeAdapter = (
  name: string,
  readyState: WalletReadyState
): FakeSolanaAdapter => {
  const adapter = {
    name: name as WalletName,
    icon: `https://example.com/${name}.png`,
    readyState,
    connect: async () => {
      if (
        adapter.readyState !== WalletReadyState.Installed &&
        adapter.readyState !== WalletReadyState.Loadable
      ) {
        throw new WalletNotReadyError();
      }
    },
  };
  return adapter;
};

const descriptorsFor = (adapters: ReadonlyArray<FakeSolanaAdapter>) =>
  getSolanaConnectors({
    wallets: adapters.map((adapter) => ({
      adapter: adapter as unknown as Adapter,
      // As the runtime answers for an adapter without a known provider global.
      isPresent: () => adapter.readyState === WalletReadyState.Installed,
      readyState: adapter.readyState,
      source: "fallback",
    })),
    connection: new Connection("https://api.mainnet-beta.solana.com"),
    variant: "default",
  }).wallets.map((createWallet) => createWallet({} as never));

const detect = (wallet: WalletDescriptor | undefined) =>
  wallet?.availability._tag === "Injected"
    ? wallet.availability.detect
    : Effect.die("Expected an injected Solana wallet");

describe("Solana wallet availability", () => {
  it.effect("detects an extension from the adapter's live readyState", () =>
    Effect.gen(function* () {
      const phantom = makeAdapter("Phantom", WalletReadyState.NotDetected);
      const solflare = makeAdapter("Solflare", WalletReadyState.Installed);
      const [phantomWallet, solflareWallet] = descriptorsFor([
        phantom,
        solflare,
      ]);

      expect(phantomWallet?.availability).toMatchObject({
        _tag: "Injected",
        installUrl:
          "https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa",
      });
      expect(yield* detect(phantomWallet)).toBe(false);
      expect(yield* detect(solflareWallet)).toBe(true);

      phantom.readyState = WalletReadyState.Installed;

      expect(yield* detect(phantomWallet)).toBe(true);
    })
  );

  it.effect(
    "treats loadable adapters as remote and unsupported ones as never present",
    () =>
      Effect.gen(function* () {
        const [walletConnect, unsupported] = descriptorsFor([
          makeAdapter("WalletConnect", WalletReadyState.Loadable),
          makeAdapter("Backpack", WalletReadyState.Unsupported),
        ]);

        expect(walletConnect?.availability).toEqual({ _tag: "Remote" });
        expect(unsupported?.availability).not.toHaveProperty("installUrl");
        expect(yield* detect(unsupported)).toBe(false);
      })
  );

  it.effect(
    "reports the wallet as unavailable when the extension is gone at connect",
    () =>
      Effect.gen(function* () {
        const [phantom] = descriptorsFor([
          makeAdapter("Phantom", WalletReadyState.NotDetected),
        ]);
        const connector = phantom?.createConnector({} as never)({
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
      })
  );
});
