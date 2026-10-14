import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Connector } from "wagmi";
import { getCardanoConnectors } from "../../../src/services/wallet/internal/adapters/cardano/cardano-connector";
import type { WalletDescriptor } from "../../../src/services/wallet/wallet-descriptors";
import { WalletNotAvailableError } from "../../../src/services/wallet/wallet-errors";

// Mainnet enterprise address: header 0x61 followed by a 28-byte key hash.
const usedAddressHex = `61${"00".repeat(28)}`;

/** A CIP-30 provider as an extension injects it into `window.cardano`. */
type Cip30Provider = {
  readonly name: string;
  readonly icon: string;
  readonly apiVersion: string;
  readonly enable: () => Promise<{
    readonly getUsedAddresses: () => Promise<ReadonlyArray<string>>;
  }>;
};

const injected: Record<string, Cip30Provider> = {};

const inject = (id: string, name: string) => {
  injected[id] = {
    name,
    icon: `data:image/svg+xml,${name}`,
    apiVersion: "0.1.0",
    enable: async () => ({
      getUsedAddresses: async () => [usedAddressHex],
    }),
  };
};

Object.defineProperty(window, "cardano", { value: injected });

afterEach(() => {
  for (const id of Object.keys(injected)) delete injected[id];
});

const descriptors = () => {
  const wallets = getCardanoConnectors().wallets.map((createWallet) =>
    createWallet({} as never)
  );
  const byId = (id: string): WalletDescriptor => {
    const wallet = wallets.find((candidate) => candidate.id === id);
    if (!wallet) throw new Error(`Cardano wallet ${id} missing`);
    return wallet;
  };
  return { byId, wallets };
};

const detect = (wallet: WalletDescriptor) =>
  wallet.availability._tag === "Injected"
    ? wallet.availability.detect
    : Effect.die(`${wallet.id} is not an injected wallet`);

const connect = (wallet: WalletDescriptor) => {
  const connector = wallet.createConnector({} as never)({
    emitter: { emit: () => undefined },
    storage: null,
  } as never) as unknown as Connector & {
    connect: () => Promise<{ accounts: ReadonlyArray<string> }>;
  };
  return connector.connect();
};

describe("Cardano wallet availability", () => {
  it.effect(
    "offers well-known extension wallets even when none is installed",
    () =>
      Effect.gen(function* () {
        const { byId, wallets } = descriptors();

        expect(wallets.map((wallet) => wallet.id)).toEqual([
          "eternl",
          "lace",
          "yoroi",
          "typhoncip30",
          "vespr",
        ]);
        expect(byId("eternl").availability).toMatchObject({
          _tag: "Injected",
          installUrl:
            "https://chromewebstore.google.com/detail/eternl/kmhcihpebfmpgmihbkipmjlmmioameka",
        });
        expect(yield* detect(byId("eternl"))).toBe(false);

        inject("eternl", "Eternl");

        expect(yield* detect(byId("eternl"))).toBe(true);
      })
  );

  it.effect("lists and connects a detected wallet outside the catalogue", () =>
    Effect.gen(function* () {
      inject("begin", "Begin");
      const { byId } = descriptors();
      const begin = byId("begin");

      expect(begin).toMatchObject({ name: "Begin" });
      expect(begin.availability).toEqual({
        _tag: "Injected",
        detect: expect.anything(),
      });
      expect(yield* detect(begin)).toBe(true);

      const { accounts } = yield* Effect.promise(() => connect(begin));

      expect(accounts[0]).toMatch(/^addr1/);
    })
  );

  it.effect(
    "reports the wallet as unavailable when the extension is gone at connect",
    () =>
      Effect.gen(function* () {
        const { byId } = descriptors();

        const error = yield* Effect.promise(() =>
          connect(byId("lace")).then(
            () => undefined,
            (cause: unknown) => cause
          )
        );

        expect(error).toBeInstanceOf(WalletNotAvailableError);
        expect(error).toMatchObject({ walletId: "lace" });
      })
  );
});
