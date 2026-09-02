import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { vi } from "vitest";
import { ValidatorAddress } from "../../src/domain/identity/identifiers";
import type { SKTxMeta } from "../../src/public-api/types";
import { makePrepareLedgerLiveTransaction } from "../../src/services/wallet/internal/adapters/ledger/prepare-ledger-live-transaction";

const substrateMethod = vi.hoisted(() => ({
  current: {
    args: {} as Record<string, unknown>,
    method: "bond",
    section: "staking",
  },
}));

vi.mock("@polkadot/types", () => ({
  TypeRegistry: class {
    createType(type: string) {
      if (type === "Extrinsic") {
        return {
          method: {
            toHuman: () => substrateMethod.current,
          },
        };
      }

      return {};
    }

    setMetadata() {}
  },
}));

type PrepareParams = {
  family?: "borrow" | "classic";
  network: string;
  tx: string;
  txMeta?: SKTxMeta;
};

const prepared = (params: PrepareParams) =>
  makePrepareLedgerLiveTransaction.pipe(
    Effect.flatMap((prepareTransaction) =>
      prepareTransaction({ ...params, family: params.family ?? "classic" })
    )
  );

const prepare = (params: PrepareParams) => prepared(params);

const prepareFailure = (params: PrepareParams) => Effect.flip(prepared(params));

const createTxMeta = (overrides: Partial<SKTxMeta>): SKTxMeta =>
  ({
    actionId: "action-id",
    actionType: "STAKE",
    address: "address",
    amount: "1",
    amountRaw: null,
    annotatedTransaction: null,
    gasEstimate: undefined,
    inputToken: {
      decimals: 6,
      name: "Cosmos",
      network: "cosmos",
      symbol: "ATOM",
    },
    providersDetails: [],
    rawArguments: null,
    structuredTransaction: null,
    txId: "tx-id",
    txType: "STAKE",
    ...overrides,
  }) as SKTxMeta;

const validatorAddress = Schema.decodeSync(ValidatorAddress);

const tronTx = JSON.stringify({
  raw_data: {
    contract: [],
    expiration: 0,
    ref_block_bytes: "",
    ref_block_hash: "",
    timestamp: 0,
  },
  raw_data_hex: "",
  txID: "",
  visible: false,
});

const polkadotTx = JSON.stringify({
  metadataRpc: "0x00",
  specName: "polkadot",
  specVersion: 1,
  tx: {
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
  },
});

const polkadotBondParams = {
  network: "polkadot",
  tx: polkadotTx,
  txMeta: createTxMeta({
    amountRaw: "1000",
    inputToken: {
      decimals: 10,
      name: "Polkadot",
      network: "polkadot",
      symbol: "DOT",
    },
  }),
};

const evmTxWithoutNonce = JSON.stringify({
  chainId: 1,
  data: "0x1234",
  from: "0x0000000000000000000000000000000000000001",
  gasLimit: "21000",
  gasPrice: "1",
  to: "0x0000000000000000000000000000000000000002",
  type: 0,
  value: "0",
});

describe("prepareLedgerLiveTransaction", () => {
  it.effect("leaves an omitted EVM nonce for Ledger Live to select", () =>
    Effect.gen(function* () {
      expect(
        yield* prepare({
          family: "borrow",
          network: "ethereum",
          tx: evmTxWithoutNonce,
        })
      ).toEqual({
        amount: "0",
        data: "1234",
        family: "ethereum",
        gasLimit: "21000",
        gasPrice: "1",
        recipient: "0x0000000000000000000000000000000000000002",
      });
    })
  );

  it.effect("requires an EVM nonce for classic Ledger transactions", () =>
    Effect.gen(function* () {
      const failure = yield* prepareFailure({
        network: "ethereum",
        tx: evmTxWithoutNonce,
        txMeta: createTxMeta({}),
      });

      expect(failure._tag).toBe("LedgerTransactionPreparationError");
    })
  );

  it.effect(
    "builds Tron vote counts in TRX units distributed across validators",
    () =>
      Effect.gen(function* () {
        const tx = (yield* prepare({
          network: "tron",
          tx: tronTx,
          txMeta: createTxMeta({
            amount: "1201",
            inputToken: {
              decimals: 6,
              name: "Tron",
              network: "tron",
              symbol: "TRX",
            },
            rawArguments: {
              amount: "1201",
              validatorAddresses: [
                validatorAddress("validator-1"),
                validatorAddress("validator-2"),
                validatorAddress("validator-3"),
              ],
            },
            txType: "VOTE",
          }),
        })) as {
          amount: string;
          votes: Array<{ address: string; voteCount: number }>;
        };

        expect(tx.amount).toBe("1201000000");
        expect(tx.votes).toEqual([
          { address: "validator-1", voteCount: 401 },
          { address: "validator-2", voteCount: 400 },
          { address: "validator-3", voteCount: 400 },
        ]);
      })
  );

  it.effect(
    "uses the accrued reward amount for Cosmos claim reward modes",
    () =>
      Effect.gen(function* () {
        const tx = (yield* prepare({
          network: "cosmos",
          tx: "{}",
          txMeta: createTxMeta({
            amount: "0.123456",
            rawArguments: {
              amount: "0.123456",
              validatorAddress: validatorAddress("cosmosvaloper1validator"),
            },
            txType: "CLAIM_REWARDS",
          }),
        })) as {
          amount: string;
          mode: string;
          validators: Array<{ address: string; amount: string }>;
        };

        expect(tx.mode).toBe("claimReward");
        expect(tx.amount).toBe("123456");
        expect(tx.validators).toEqual([
          { address: "cosmosvaloper1validator", amount: "123456" },
        ]);
      })
  );

  it.effect(
    "falls back to zero for Cosmos claim modes without a known reward amount",
    () =>
      Effect.gen(function* () {
        const tx = (yield* prepare({
          network: "cosmos",
          tx: "{}",
          txMeta: createTxMeta({
            amount: null,
            rawArguments: {
              validatorAddress: validatorAddress("cosmosvaloper1validator"),
            },
            txType: "CLAIM_REWARDS",
          }),
        })) as {
          amount: string;
          validators: Array<{ address: string; amount: string }>;
        };

        expect(tx.amount).toBe("0");
        expect(tx.validators).toEqual([
          { address: "cosmosvaloper1validator", amount: "0" },
        ]);
      })
  );

  it.effect("requires amount for Cosmos non-claim modes", () =>
    Effect.gen(function* () {
      expect(
        yield* prepareFailure({
          network: "cosmos",
          tx: "{}",
          txMeta: createTxMeta({
            amount: null,
            rawArguments: {
              validatorAddress: validatorAddress("cosmosvaloper1validator"),
            },
            txType: "STAKE",
          }),
        })
      ).toMatchObject({
        _tag: "LedgerTransactionPreparationError",
        message: "Missing Cosmos Ledger arguments",
      });
    })
  );

  it.effect("requires classic transaction metadata for Polkadot", () =>
    Effect.gen(function* () {
      expect(
        yield* prepareFailure({
          network: "polkadot",
          tx: polkadotTx,
        })
      ).toMatchObject({
        _tag: "LedgerTransactionPreparationError",
        message: "Missing classic transaction metadata",
      });
    })
  );

  it.effect("uses the Polkadot bond payee as Ledger reward destination", () =>
    Effect.gen(function* () {
      substrateMethod.current = {
        args: {
          payee: "Stash",
          rewardDestination: "Controller",
          value: "1,000",
        },
        method: "bond",
        section: "staking",
      };

      const tx = (yield* prepare(polkadotBondParams)) as {
        amount: string;
        rewardDestination?: string;
      };

      expect(tx.amount).toBe("1000");
      expect(tx.rewardDestination).toBe("Stash");
    })
  );
});
