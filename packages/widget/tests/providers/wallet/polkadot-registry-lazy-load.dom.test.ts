import { describe, expect, it } from "@effect/vitest";
import type { RawTransaction } from "@ledgerhq/wallet-api-core";
import { Effect, Result } from "effect";
import { vi } from "vitest";
import type { Network } from "../../../src/domain/network/network";
import type { SKTxMeta } from "../../../src/public-api/types";
import { makePrepareLedgerLiveTransaction } from "../../../src/services/wallet/internal/adapters/ledger/prepare-ledger-live-transaction";
import { getConfig as getSubstrateConfig } from "../../../src/services/wallet/internal/adapters/substrate/config";

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
  "../../../src/services/wallet/internal/adapters/substrate/extrinsic-encoding",
  () => {
    evaluated.extrinsicEncoding += 1;

    return { encodeSignedExtrinsic };
  }
);

vi.mock(
  "../../../src/services/wallet/internal/adapters/ledger/polkadot-ledger-transaction",
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

const makeSubstrateConnector = () =>
  Effect.gen(function* () {
    const { connector: group, substrateChains } = yield* getSubstrateConfig({
      buildConnectors: true,
      enabledNetworks: substrateNetworks,
      forceWalletConnectOnly: false,
    });

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
  });

const signWithSubstrateConnector = (
  connector: Effect.Success<ReturnType<typeof makeSubstrateConnector>>
) =>
  connector.signTransaction({
    metadataRpc: "0x00",
    rawTx: "{}",
    tx: signerPayload,
  });

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
    network: "polkadot",
    symbol: "DOT",
  },
  providersDetails: [],
  rawArguments: null,
  structuredTransaction: null,
  txId: "tx-id",
  txType: "STAKE",
} as unknown as SKTxMeta;

describe("Polkadot registry lazy load", () => {
  it.live(
    "builds Substrate wallets and signs pre-encoded transactions without the registry",
    () =>
      Effect.gen(function* () {
        const connector = yield* makeSubstrateConnector();

        expect(evaluated.extrinsicEncoding).toBe(0);

        signPayload.mockResolvedValueOnce({
          id: 1,
          signature: "0xsignature",
          signedTransaction: "0xpre-encoded",
        });

        expect(yield* signWithSubstrateConnector(connector)).toBe(
          "0xpre-encoded"
        );
        expect(evaluated.extrinsicEncoding).toBe(0);
        expect(encodeSignedExtrinsic).not.toHaveBeenCalled();
      })
  );

  it.live(
    "loads the extrinsic encoder once, on the first signature that needs it",
    () =>
      Effect.gen(function* () {
        const connector = yield* makeSubstrateConnector();

        expect(yield* signWithSubstrateConnector(connector)).toBe(
          "0xencoded-extrinsic"
        );
        expect(evaluated.extrinsicEncoding).toBe(1);
        expect(encodeSignedExtrinsic).toHaveBeenCalledWith({
          metadataRpc: "0x00",
          signature: "0xsignature",
          tx: signerPayload,
        });

        expect(yield* signWithSubstrateConnector(connector)).toBe(
          "0xencoded-extrinsic"
        );
        expect(evaluated.extrinsicEncoding).toBe(1);
      })
  );

  it.live(
    "prepares non-Polkadot Ledger transactions without the Polkadot builder",
    () =>
      Effect.gen(function* () {
        const prepareTransaction = yield* makePrepareLedgerLiveTransaction;

        expect(evaluated.polkadotLedgerTransaction).toBe(0);

        yield* prepareTransaction({
          network: "cosmos",
          tx: "{}",
          txMeta: {
            ...txMeta,
            rawArguments: { validatorAddress: "cosmosvaloper1validator" },
          } as SKTxMeta,
        });

        expect(evaluated.polkadotLedgerTransaction).toBe(0);
      })
  );

  it.live(
    "loads the Polkadot Ledger builder once, on the first Polkadot transaction",
    () =>
      Effect.gen(function* () {
        const prepareTransaction = yield* makePrepareLedgerLiveTransaction;

        yield* prepareTransaction({
          network: "polkadot",
          tx: polkadotLedgerTx,
          txMeta,
        });

        expect(evaluated.polkadotLedgerTransaction).toBe(1);
        expect(buildPolkadotLedgerTransaction).toHaveBeenCalledTimes(1);

        yield* prepareTransaction({
          network: "polkadot",
          tx: polkadotLedgerTx,
          txMeta,
        });

        expect(evaluated.polkadotLedgerTransaction).toBe(1);
        expect(buildPolkadotLedgerTransaction).toHaveBeenCalledTimes(2);
      })
  );
});
