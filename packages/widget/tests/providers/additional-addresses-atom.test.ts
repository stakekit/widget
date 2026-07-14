import type { ChainWalletBase } from "@cosmos-kit/core";
import { Effect, Layer, Schema } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import { describe, expect, it, vi } from "vitest";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { CosmosConnector } from "../../src/providers/cosmos/cosmos-connector-meta";
import { WidgetPersistence } from "../../src/providers/effect-atom-runtime/persistence";
import { getCosmosAdditionalAddresses } from "../../src/providers/wallet/state/additional-addresses";

const address = Schema.decodeSync(WalletAddress)("cosmos1stored");
const storedPublicKey = "A".repeat(44);
const derivedPublicKey = "B".repeat(44);
const persistenceLayer = Layer.effect(
  WidgetPersistence,
  WidgetPersistence.make
).pipe(Layer.provide(KeyValueStore.layerMemory));

const makeInputs = () => {
  const getAccount = vi.fn(async () => ({ pubkey: new Uint8Array([1, 2, 3]) }));
  const toBase64 = vi.fn(() => derivedPublicKey);

  return {
    chainWallet: {
      chainId: "cosmoshub-4",
      client: { getAccount },
    } as unknown as ChainWalletBase,
    connector: { toBase64 } as unknown as CosmosConnector,
    getAccount,
    toBase64,
  };
};

describe("additional addresses atom boundary", () => {
  it("uses the persisted Cosmos public key for the atom-owned address", async () => {
    const { chainWallet, connector, getAccount, toBase64 } = makeInputs();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const persistence = yield* WidgetPersistence;
        yield* persistence.upsertStoredPublicKey({
          address,
          publicKey: storedPublicKey,
        });

        return yield* getCosmosAdditionalAddresses({
          address,
          chainWallet,
          connector,
        });
      }).pipe(Effect.provide(persistenceLayer))
    );

    expect(result).toEqual({ cosmosPubKey: storedPublicKey });
    expect(getAccount).not.toHaveBeenCalled();
    expect(toBase64).not.toHaveBeenCalled();
  });

  it("derives the Cosmos public key when persistence has no address entry", async () => {
    const { chainWallet, connector, getAccount, toBase64 } = makeInputs();
    const result = await Effect.runPromise(
      getCosmosAdditionalAddresses({
        address,
        chainWallet,
        connector,
      }).pipe(Effect.provide(persistenceLayer))
    );

    expect(result).toEqual({ cosmosPubKey: derivedPublicKey });
    expect(getAccount).toHaveBeenCalledWith("cosmoshub-4");
    expect(toBase64).toHaveBeenCalledOnce();
  });
});
