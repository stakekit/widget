import type { RawTransaction } from "@ledgerhq/wallet-api-core";
import { Effect, Result } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Network } from "../../../src/domain/schema/network-model";
import { SubstrateNetworks } from "../../../src/domain/types/chains/networks";
import type { SKTxMeta } from "../../../src/public-api/types";
import { makePrepareLedgerLiveTransaction } from "../../../src/services/wallet/connectors/ledger/prepare-ledger-live-transaction";
import { getConfig as getSubstrateConfig } from "../../../src/services/wallet/connectors/substrate/config";

/**
 * `@polkadot/types` inflates a large network registry when it is evaluated, and
 * these two modules are the only ones that import it. Counting how often their
 * mock factories run is therefore the assertion that matters: a connector that
 * has merely been constructed must leave both counters at zero.
 */
const evaluated = vi.hoisted(() => ({
  extrinsicEncoding: 0,
  polkadotLedgerTransaction: 0,
}));

const encodeSignedExtrinsic = vi.hoisted(() =>
  vi.fn(() => "0xencoded-extrinsic")
);

const buildPolkadotLedgerTransaction = vi.hoisted(() =>
  vi.fn(() => Result.succeed({ family: "polkadot" } as RawTransaction))
);

vi.mock(
  "../../../src/services/wallet/connectors/substrate/extrinsic-encoding",
  () => {
    evaluated.extrinsicEncoding += 1;

    return { encodeSignedExtrinsic };
  }
);

vi.mock(
  "../../../src/services/wallet/connectors/ledger/polkadot-ledger-transaction",
  () => {
    evaluated.polkadotLedgerTransaction += 1;

    return { buildPolkadotLedgerTransaction };
  }
);

const signPayload = vi.hoisted(() =>
  vi.fn(
    async (): Promise<Record<string, unknown>> => ({
      id: 1,
      signature: "0xsignature",
    })
  )
);

vi.mock("@luno-kit/core/connectors", () => {
  const baseConnector = (id: string, name: string) => ({
    connect: async () => [],
    disconnect: async () => undefined,
    emit: () => undefined,
    getAccounts: async () => [],
    getSigner: async () => ({ signPayload }),
    icon: "",
    id,
    isInstalled: () => true,
    links: { browserExtension: "" },
    name,
    once: () => undefined,
  });

  return {
    subwalletConnector: () => baseConnector("subwallet", "SubWallet"),
    talismanConnector: () => baseConnector("talisman", "Talisman"),
    walletConnectConnector: () =>
      baseConnector("walletConnect", "WalletConnect"),
  };
});

const substrateNetworks = new Set<Network>(["polkadot"]);

const signerPayload = {
  address: "polkadot-address",
  blockHash: "0x00",
  blockNumber: "0x00",
  era: "0x00",
  genesisHash: "0x00",
  metadataRpc: "0x00",
  method: "0x00",
  nonce: "0x00",
  signedExtensions: [],
  specVersion: "0x00",
  tip: "0x00",
  transactionVersion: "0x00",
  version: 4,
};

const makeSubstrateConnector = async () => {
  const { connector: group, substrateChains } = await Effect.runPromise(
    getSubstrateConfig({
      buildConnectors: true,
      enabledNetworks: substrateNetworks,
      forceWalletConnectOnly: false,
    })
  );

  if (!group) throw new Error("Substrate connector group was not built");

  const wallet = group.wallets[1]?.({} as never);

  if (!wallet) throw new Error("Substrate wallet was not built");

  return wallet.createConnector({} as never)({
    chains: substrateChains as never,
    emitter: { emit: () => undefined } as never,
    providers: [],
    storage: null,
  }) as unknown as {
    signTransaction: (payload: {
      metadataRpc: string;
      rawTx: string;
      tx: typeof signerPayload;
    }) => Effect.Effect<string, Error>;
  };
};

const signWithSubstrateConnector = async (
  connector: Awaited<ReturnType<typeof makeSubstrateConnector>>
) =>
  Effect.runPromise(
    connector.signTransaction({
      metadataRpc: "0x00",
      rawTx: "{}",
      tx: signerPayload,
    })
  );

const polkadotLedgerTx = JSON.stringify({
  metadataRpc: "0x00",
  specName: "polkadot",
  specVersion: 1,
  tx: signerPayload,
});

const txMeta = {
  actionId: "action-id",
  actionType: "STAKE",
  address: "address",
  amount: "1",
  amountRaw: "1000",
  annotatedTransaction: null,
  gasEstimate: undefined,
  inputToken: {
    decimals: 10,
    name: "Polkadot",
    network: SubstrateNetworks.Polkadot,
    symbol: "DOT",
  },
  providersDetails: [],
  rawArguments: null,
  structuredTransaction: null,
  txId: "tx-id",
  txType: "STAKE",
} as unknown as SKTxMeta;

describe("Polkadot registry lazy load", () => {
  it("builds Substrate wallets and signs pre-encoded transactions without the registry", async () => {
    const connector = await makeSubstrateConnector();

    expect(evaluated.extrinsicEncoding).toBe(0);

    signPayload.mockResolvedValueOnce({
      id: 1,
      signature: "0xsignature",
      signedTransaction: "0xpre-encoded",
    });

    await expect(signWithSubstrateConnector(connector)).resolves.toBe(
      "0xpre-encoded"
    );
    expect(evaluated.extrinsicEncoding).toBe(0);
    expect(encodeSignedExtrinsic).not.toHaveBeenCalled();
  });

  it("loads the extrinsic encoder once, on the first signature that needs it", async () => {
    const connector = await makeSubstrateConnector();

    await expect(signWithSubstrateConnector(connector)).resolves.toBe(
      "0xencoded-extrinsic"
    );
    expect(evaluated.extrinsicEncoding).toBe(1);
    expect(encodeSignedExtrinsic).toHaveBeenCalledWith({
      metadataRpc: "0x00",
      signature: "0xsignature",
      tx: signerPayload,
    });

    await expect(signWithSubstrateConnector(connector)).resolves.toBe(
      "0xencoded-extrinsic"
    );
    expect(evaluated.extrinsicEncoding).toBe(1);
  });

  it("prepares non-Polkadot Ledger transactions without the Polkadot builder", async () => {
    const prepareTransaction = await Effect.runPromise(
      makePrepareLedgerLiveTransaction
    );

    expect(evaluated.polkadotLedgerTransaction).toBe(0);

    await Effect.runPromise(
      prepareTransaction({
        network: "cosmos",
        tx: "{}",
        txMeta: {
          ...txMeta,
          rawArguments: { validatorAddress: "cosmosvaloper1validator" },
        } as SKTxMeta,
      })
    );

    expect(evaluated.polkadotLedgerTransaction).toBe(0);
  });

  it("loads the Polkadot Ledger builder once, on the first Polkadot transaction", async () => {
    const prepareTransaction = await Effect.runPromise(
      makePrepareLedgerLiveTransaction
    );

    await Effect.runPromise(
      prepareTransaction({
        network: SubstrateNetworks.Polkadot,
        tx: polkadotLedgerTx,
        txMeta,
      })
    );

    expect(evaluated.polkadotLedgerTransaction).toBe(1);
    expect(buildPolkadotLedgerTransaction).toHaveBeenCalledTimes(1);

    await Effect.runPromise(
      prepareTransaction({
        network: SubstrateNetworks.Polkadot,
        tx: polkadotLedgerTx,
        txMeta,
      })
    );

    expect(evaluated.polkadotLedgerTransaction).toBe(1);
    expect(buildPolkadotLedgerTransaction).toHaveBeenCalledTimes(2);
  });
});
