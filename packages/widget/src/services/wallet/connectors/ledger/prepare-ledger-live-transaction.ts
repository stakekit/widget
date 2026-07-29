import type {
  RawEthereumTransaction,
  RawTransaction,
  RawTronTransaction,
} from "@ledgerhq/wallet-api-core";
import {
  Cell,
  type CommonMessageInfoRelaxedInternal,
  loadMessageRelaxed,
} from "@ton/core";
import BigNumber from "bignumber.js";
import { Effect, Option, Result, Schema } from "effect";
import { hexToBytes } from "viem";
import { isEvmChain } from "../../../../domain/types/chains";
import {
  CosmosNetworks,
  EvmNetworks,
  MiscNetworks,
  SubstrateNetworks,
} from "../../../../domain/types/chains/networks";
import {
  substratePayloadCodec,
  unsignedEVMTransactionCodec,
  unsignedTonTransactionCodec,
  unsignedTronTransactionCodec,
} from "../../../../domain/types/transaction";
import type { SKTxMeta } from "../../../../public-api/types";
import type { BuildPolkadotLedgerTransaction } from "./polkadot-ledger-transaction";

type PrepareLedgerLiveTransactionParams = {
  tx: string;
  network: string;
  txMeta?: SKTxMeta;
};

const GasEstimate = Schema.NullOr(
  Schema.Struct({
    amount: Schema.optional(Schema.NullOr(Schema.String)),
    gasLimit: Schema.optional(Schema.NullOr(Schema.String)),
    token: Schema.optional(
      Schema.NullOr(
        Schema.Struct({
          decimals: Schema.Number,
        })
      )
    ),
  })
);
type GasEstimate = typeof GasEstimate.Type;

const GasEstimateFromJson = Schema.fromJsonString(GasEstimate);
const UnknownFromJson = Schema.fromJsonString(Schema.Unknown);

const eip1559FieldsUnsupportedNetworks = new Set<string>([
  EvmNetworks.Polygon,
  EvmNetworks.Optimism,
  EvmNetworks.Arbitrum,
  EvmNetworks.AvalancheC,
  EvmNetworks.Core,
]);

const decodeSchema = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown
): Result.Result<S["Type"], string> =>
  Schema.decodeUnknownResult(schema)(input).pipe(
    Result.mapError((error) => error.message)
  );

export type PrepareLedgerLiveTransaction = (
  params: PrepareLedgerLiveTransactionParams
) => Effect.Effect<RawTransaction, string>;

/**
 * The Polkadot builder pulls in `@polkadot/types`, whose evaluation inflates a
 * large network registry. Loading it is deferred to the first Polkadot
 * transaction and memoized for the lifetime of the connector that owns the
 * returned preparer; every other network stays fully synchronous.
 */
export const makePrepareLedgerLiveTransaction: Effect.Effect<PrepareLedgerLiveTransaction> =
  Effect.gen(function* () {
    const loadPolkadotBuilder = yield* Effect.cached(
      Effect.tryPromise({
        try: () =>
          import("./polkadot-ledger-transaction").then(
            (module) => module.buildPolkadotLedgerTransaction
          ),
        catch: () => "Could not load Polkadot transaction support",
      })
    );

    return ({ network, tx, txMeta }) => {
      if (network === SubstrateNetworks.Polkadot) {
        return txMeta
          ? preparePolkadotTransaction({ loadPolkadotBuilder, tx, txMeta })
          : Effect.fail("Missing classic transaction metadata");
      }

      return Effect.fromResult(
        prepareSynchronousTransaction({ network, tx, txMeta })
      );
    };
  });

const preparePolkadotTransaction = ({
  loadPolkadotBuilder,
  tx,
  txMeta,
}: {
  loadPolkadotBuilder: Effect.Effect<BuildPolkadotLedgerTransaction, string>;
  tx: string;
  txMeta: SKTxMeta;
}): Effect.Effect<RawTransaction, string> =>
  Effect.fromResult(
    parseJson(tx).pipe(
      Result.flatMap((value) => decodeSchema(substratePayloadCodec, value))
    )
  ).pipe(
    Effect.flatMap((payload) =>
      loadPolkadotBuilder.pipe(
        Effect.flatMap((buildPolkadotLedgerTransaction) =>
          Effect.fromResult(
            buildPolkadotLedgerTransaction({
              fee: getFeeInBaseUnits(
                parseGasEstimate(txMeta.gasEstimate)
              ).toString(),
              payload,
              txMeta,
            })
          )
        )
      )
    )
  );

const prepareSynchronousTransaction = ({
  network,
  tx,
  txMeta,
}: PrepareLedgerLiveTransactionParams): Result.Result<
  RawTransaction,
  string
> => {
  const parsedTx = parseJson(tx);

  if (Result.isFailure(parsedTx)) {
    return Result.fail(parsedTx.failure);
  }

  if (isEvmChain(network)) {
    return parsedTx.pipe(
      Result.flatMap((value) =>
        decodeSchema(unsignedEVMTransactionCodec, value).pipe(
          Result.map((decodedTx) =>
            buildEthereumLedgerTransaction({
              network,
              tx: decodedTx,
            })
          )
        )
      )
    );
  }

  if (!txMeta) {
    return Result.fail("Missing classic transaction metadata");
  }

  switch (network) {
    case MiscNetworks.Tron:
      return parsedTx.pipe(
        Result.flatMap((value) =>
          decodeSchema(unsignedTronTransactionCodec, value).pipe(
            Result.flatMap(() => buildTronLedgerTransaction(txMeta))
          )
        )
      );
    case MiscNetworks.Near:
      return buildNearLedgerTransaction(txMeta);
    case MiscNetworks.Tezos:
      return buildTezosLedgerTransaction(txMeta);
    case MiscNetworks.Ton:
      return parsedTx.pipe(
        Result.flatMap((value) =>
          decodeSchema(unsignedTonTransactionCodec, value).pipe(
            Result.flatMap((decodedTx) =>
              buildTonLedgerTransaction(decodedTx, txMeta)
            )
          )
        )
      );
    default:
      if (isCosmosNetwork(network)) {
        return buildCosmosLedgerTransaction(txMeta);
      }

      return parsedTx.pipe(Result.map((value) => value as RawTransaction));
  }
};

const parseJson = (value: string): Result.Result<unknown, string> => {
  return Schema.decodeResult(UnknownFromJson)(value).pipe(
    Result.mapError(() => "Failed to parse tx")
  );
};

const buildEthereumLedgerTransaction = ({
  network,
  tx,
}: {
  network: string;
  tx: typeof unsignedEVMTransactionCodec.Type;
}): RawTransaction => {
  const ledgerTx: RawEthereumTransaction = {
    amount: (tx.value ?? 0n).toString(),
    recipient: tx.to,
    family: "ethereum",
    nonce: tx.nonce,
    gasLimit: tx.gasLimit.toString(),
    data: Buffer.from(hexToBytes(tx.data)).toString("hex"),
  };

  if (
    tx.maxFeePerGas &&
    tx.maxPriorityFeePerGas &&
    !eip1559FieldsUnsupportedNetworks.has(network)
  ) {
    ledgerTx.maxFeePerGas = tx.maxFeePerGas.toString();
    ledgerTx.maxPriorityFeePerGas = tx.maxPriorityFeePerGas.toString();
  } else if (tx.gasPrice) {
    ledgerTx.gasPrice = tx.gasPrice.toString();
  }

  return ledgerTx as RawTransaction;
};

const buildCosmosLedgerTransaction = (
  txMeta: SKTxMeta
): Result.Result<RawTransaction, string> => {
  const validatorAddress = txMeta.rawArguments?.validatorAddress;
  const mode = getCosmosMode(txMeta.txType);
  const actionAmount = getActionAmountInBaseUnits(txMeta);
  const amount =
    actionAmount ?? (isCosmosClaimMode(mode) ? new BigNumber(0) : null);

  if (!validatorAddress || amount === null) {
    return Result.fail("Missing Cosmos Ledger arguments");
  }

  return Result.succeed({
    family: "cosmos",
    mode,
    validators: [
      {
        address: validatorAddress,
        amount: amount.toString(),
      },
    ],
    amount: amount.toString(),
    recipient: validatorAddress,
    memo: "via StakeKit CID-1009",
  } as RawTransaction);
};

const buildTronLedgerTransaction = (
  txMeta: SKTxMeta
): Result.Result<RawTronTransaction, string> => {
  const amount = getActionAmountInBaseUnits(txMeta);
  const resource = txMeta.rawArguments?.tronResource;
  const validatorAddress =
    txMeta.rawArguments?.validatorAddress ??
    txMeta.rawArguments?.validatorAddresses?.[0];

  const tronLedgerTx = (() => {
    switch (txMeta.txType) {
      case "FREEZE_BANDWIDTH":
      case "FREEZE_ENERGY":
        if (!amount || !resource)
          return Result.fail("Missing Tron freeze arguments");
        return Result.succeed({
          amount: amount.toString(),
          recipient: txMeta.address ?? "",
          family: "tron",
          mode: "freeze",
          resource,
        } as RawTronTransaction);
      case "VOTE": {
        const validatorAddresses = txMeta.rawArguments?.validatorAddresses;

        if (!amount || !validatorAddresses?.length) {
          return Result.fail("Missing Tron vote arguments");
        }

        return getTronVotes({
          txMeta,
          validatorAddresses,
        }).pipe(
          Result.map(
            (votes) =>
              ({
                amount: amount.toString(),
                recipient: txMeta.address ?? "",
                family: "tron",
                mode: "vote",
                votes,
              }) as RawTronTransaction
          )
        );
      }
      case "UNDELEGATE_BANDWIDTH":
      case "UNDELEGATE_ENERGY":
        if (!amount || !resource || !validatorAddress) {
          return Result.fail("Missing Tron undelegate arguments");
        }
        return Result.succeed({
          amount: amount.toString(),
          recipient: String(validatorAddress),
          family: "tron",
          mode: "unDelegateResource",
          resource,
        } as RawTronTransaction);
      case "UNFREEZE_LEGACY_BANDWIDTH":
      case "UNFREEZE_LEGACY_ENERGY":
        return Result.succeed({
          amount: "0",
          recipient: "",
          family: "tron",
          mode: "legacyUnfreeze",
          resource,
        } as RawTronTransaction);
      case "UNFREEZE_BANDWIDTH":
      case "UNFREEZE_ENERGY":
        if (!amount || !resource)
          return Result.fail("Missing Tron unfreeze arguments");
        return Result.succeed({
          amount: amount.toString(),
          recipient: txMeta.address ?? "",
          family: "tron",
          mode: "unfreeze",
          resource,
        } as RawTronTransaction);
      case "CLAIM_REWARDS":
        return Result.succeed({
          amount: "0",
          recipient: txMeta.address ?? "",
          family: "tron",
          mode: "claimReward",
        } as RawTronTransaction);
      default:
        return Result.fail(
          `Unsupported Tron Ledger transaction type: ${txMeta.txType}`
        );
    }
  })();

  return tronLedgerTx.pipe(
    Result.map((tx) => ({ ...tx, votes: tx.votes ?? [] }))
  );
};

const buildNearLedgerTransaction = (
  txMeta: SKTxMeta
): Result.Result<RawTransaction, string> => {
  const validatorAddress = txMeta.rawArguments?.validatorAddress;
  const amount = getActionAmountInBaseUnits(txMeta);

  if (!validatorAddress || !amount) {
    return Result.fail("Missing Near Ledger arguments");
  }

  return Result.succeed({
    amount: amount.toString(),
    recipient: validatorAddress,
    family: "near",
    mode: getNearMode(txMeta.txType),
    fees: getFeeInBaseUnits(parseGasEstimate(txMeta.gasEstimate)).toString(),
  } as RawTransaction);
};

const buildTezosLedgerTransaction = (
  txMeta: SKTxMeta
): Result.Result<RawTransaction, string> => {
  const gasEstimate = parseGasEstimate(txMeta.gasEstimate);
  const isUnstake = txMeta.txType === "UNSTAKE";
  const recipient = isUnstake ? "" : txMeta.rawArguments?.validatorAddress;

  if (!isUnstake && !recipient) {
    return Result.fail("Missing Tezos Ledger validator");
  }

  return Result.succeed({
    family: "tezos",
    mode: isUnstake ? "undelegate" : "delegate",
    amount: "0",
    recipient: recipient ?? "",
    fees: getFeeInBaseUnits(gasEstimate).toString(),
    gasLimit: String(gasEstimate?.gasLimit ?? 0),
  } as RawTransaction);
};

const buildTonLedgerTransaction = (
  tx: typeof unsignedTonTransactionCodec.Type,
  txMeta: SKTxMeta
): Result.Result<RawTransaction, string> => {
  const gasEstimate = parseGasEstimate(txMeta.gasEstimate);

  if (!("message" in tx)) {
    const firstMessage = tx[0];

    if (!firstMessage) {
      return Result.fail("Unsupported Ton Ledger transaction payload");
    }

    return Result.succeed({
      family: "ton",
      amount: firstMessage.amount,
      recipient: firstMessage.address,
      fees: getFeeInBaseUnits(gasEstimate).toString(),
      comment: {
        text: firstMessage.payload,
        isEncrypted: false,
      },
    } as RawTransaction);
  }

  try {
    const parsedTx = loadMessageRelaxed(
      Cell.fromBase64(tx.message).beginParse()
    );
    const info = parsedTx.info as CommonMessageInfoRelaxedInternal;

    return Result.succeed({
      family: "ton",
      amount: info.value.coins.toString(),
      recipient: info.dest.toString(),
      fees: getFeeInBaseUnits(gasEstimate).toString(),
      comment: {
        text: parsedTx.body.toBoc().toString("base64"),
        isEncrypted: false,
      },
    } as RawTransaction);
  } catch {
    return Result.fail("Unsupported Ton Ledger transaction payload");
  }
};

const isCosmosNetwork = (network: string): network is CosmosNetworks =>
  Object.values(CosmosNetworks).includes(network as CosmosNetworks);

const parseGasEstimate = (
  gasEstimate: SKTxMeta["gasEstimate"]
): GasEstimate => {
  if (!gasEstimate) return null;

  return Schema.decodeOption(GasEstimateFromJson)(gasEstimate).pipe(
    Option.getOrNull
  );
};

const getActionAmountInBaseUnits = (txMeta: SKTxMeta): BigNumber | null => {
  if (txMeta.amountRaw) {
    return new BigNumber(txMeta.amountRaw);
  }

  const amount = txMeta.rawArguments?.amount ?? txMeta.amount;
  const decimals = txMeta.inputToken?.decimals;

  if (!amount || decimals === undefined) {
    return null;
  }

  return new BigNumber(amount).multipliedBy(new BigNumber(10).pow(decimals));
};

const getFeeInBaseUnits = (gasEstimate: GasEstimate): BigNumber => {
  if (!gasEstimate?.amount || !gasEstimate.token) {
    return new BigNumber(0);
  }

  return new BigNumber(gasEstimate.amount).multipliedBy(
    new BigNumber(10).pow(gasEstimate.token.decimals)
  );
};

const getCosmosMode = (txType: SKTxMeta["txType"]): string => {
  switch (txType) {
    case "STAKE":
      return "delegate";
    case "UNSTAKE":
      return "undelegate";
    case "RESTAKE":
    case "REBOND":
      return "redelegate";
    case "RESTAKE_REWARDS":
      return "claimRewardCompound";
    case "CLAIM_REWARDS":
      return "claimReward";
    default:
      return "delegate";
  }
};

const isCosmosClaimMode = (mode: string): boolean =>
  mode === "claimReward" || mode === "claimRewardCompound";

const getNearMode = (txType: SKTxMeta["txType"]): string => {
  switch (txType) {
    case "STAKE":
      return "stake";
    case "UNSTAKE":
      return "unstake";
    case "WITHDRAW":
    case "CLAIM_UNSTAKED":
      return "withdraw";
    default:
      return "stake";
  }
};

const getActionAmountInTokenUnits = (txMeta: SKTxMeta): BigNumber | null => {
  const amount = txMeta.rawArguments?.amount ?? txMeta.amount;

  if (amount) {
    return new BigNumber(amount);
  }

  const decimals = txMeta.inputToken?.decimals;

  if (!txMeta.amountRaw || decimals === undefined) {
    return null;
  }

  return new BigNumber(txMeta.amountRaw).dividedBy(
    new BigNumber(10).pow(decimals)
  );
};

const getTronVotes = ({
  txMeta,
  validatorAddresses,
}: {
  txMeta: SKTxMeta;
  validatorAddresses: ReadonlyArray<string>;
}): Result.Result<{ address: string; voteCount: number }[], string> => {
  const amount = getActionAmountInTokenUnits(txMeta);

  if (!amount) {
    return Result.fail("Missing Tron vote arguments");
  }

  const validatorsCount = validatorAddresses.length;
  const equalVoteCount = amount.dividedToIntegerBy(validatorsCount);
  const remainingVotes = amount
    .modulo(validatorsCount)
    .integerValue(BigNumber.ROUND_FLOOR);

  if (
    !equalVoteCount.isFinite() ||
    !remainingVotes.isFinite() ||
    equalVoteCount.isNegative() ||
    remainingVotes.isNegative()
  ) {
    return Result.fail("Invalid Tron vote count");
  }

  if (equalVoteCount.plus(1).gt(Number.MAX_SAFE_INTEGER)) {
    return Result.fail("Tron vote count exceeds Ledger limits");
  }

  return Result.succeed(
    validatorAddresses.map((address, index) => ({
      address,
      voteCount: equalVoteCount
        .plus(index < remainingVotes.toNumber() ? 1 : 0)
        .toNumber(),
    }))
  );
};
