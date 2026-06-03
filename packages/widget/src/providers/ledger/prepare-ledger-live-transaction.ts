import type {
  RawEthereumTransaction,
  RawTransaction,
  RawTronTransaction,
} from "@ledgerhq/wallet-api-core";
import { TypeRegistry } from "@polkadot/types";
import {
  Cell,
  type CommonMessageInfoRelaxedInternal,
  loadMessageRelaxed,
} from "@ton/core";
import BigNumber from "bignumber.js";
import { Either, Left, Right } from "purify-ts";
import { hexToBytes } from "viem";
import { isEvmChain } from "../../domain/types/chains";
import {
  CosmosNetworks,
  EvmNetworks,
  MiscNetworks,
  SubstrateNetworks,
} from "../../domain/types/chains/networks";
import {
  substratePayloadCodec,
  unsignedEVMTransactionCodec,
  unsignedTonTransactionCodec,
  unsignedTronTransactionCodec,
} from "../../domain/types/transaction";
import type { SKTxMeta } from "../../domain/types/wallets/generic-wallet";

type PrepareLedgerLiveTransactionParams = {
  tx: string;
  network: string;
  txMeta: SKTxMeta;
};

type GasEstimate = {
  amount?: string | null;
  gasLimit?: string | null;
  token?: {
    decimals: number;
  } | null;
} | null;

type SubstrateHumanMethod = {
  section: string;
  method: string;
  args: Record<string, unknown> | null;
};

const eip1559FieldsUnsupportedNetworks = new Set<string>([
  EvmNetworks.Polygon,
  EvmNetworks.Optimism,
  EvmNetworks.Arbitrum,
  EvmNetworks.AvalancheC,
  EvmNetworks.Core,
]);

export const prepareLedgerLiveTransaction = ({
  network,
  tx,
  txMeta,
}: PrepareLedgerLiveTransactionParams): Either<string, RawTransaction> => {
  const parsedTx = parseJson(tx);

  if (parsedTx.isLeft()) {
    return parsedTx;
  }

  if (isEvmChain(network)) {
    return parsedTx.chain((value) =>
      unsignedEVMTransactionCodec
        .decode(value)
        .mapLeft(String)
        .map((decodedTx) =>
          buildEthereumLedgerTransaction({
            network,
            tx: decodedTx,
          })
        )
    );
  }

  switch (network) {
    case SubstrateNetworks.Polkadot:
      return parsedTx.chain((value) =>
        substratePayloadCodec
          .decode(value)
          .mapLeft(String)
          .chain((payload) =>
            buildPolkadotLedgerTransaction({
              gasEstimate: parseGasEstimate(txMeta.gasEstimate),
              payload,
              txMeta,
            })
          )
      );
    case MiscNetworks.Tron:
      return parsedTx.chain((value) =>
        unsignedTronTransactionCodec
          .decode(value)
          .mapLeft(String)
          .chain(() => buildTronLedgerTransaction(txMeta))
      );
    case MiscNetworks.Near:
      return buildNearLedgerTransaction(txMeta);
    case MiscNetworks.Tezos:
      return buildTezosLedgerTransaction(txMeta);
    case MiscNetworks.Ton:
      return parsedTx.chain((value) =>
        unsignedTonTransactionCodec
          .decode(value)
          .mapLeft(String)
          .chain((decodedTx) => buildTonLedgerTransaction(decodedTx, txMeta))
      );
    default:
      if (isCosmosNetwork(network)) {
        return buildCosmosLedgerTransaction(txMeta);
      }

      return parsedTx.map((value) => value as RawTransaction);
  }
};

const parseJson = (value: string): Either<string, unknown> =>
  Either.encase(() => JSON.parse(value)).mapLeft(() => "Failed to parse tx");

const buildEthereumLedgerTransaction = ({
  network,
  tx,
}: {
  network: string;
  tx: ReturnType<typeof unsignedEVMTransactionCodec.decode> extends Either<
    string,
    infer T
  >
    ? T
    : never;
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

const buildPolkadotLedgerTransaction = ({
  gasEstimate,
  payload,
  txMeta,
}: {
  gasEstimate: GasEstimate;
  payload: ReturnType<typeof substratePayloadCodec.decode> extends Either<
    string,
    infer T
  >
    ? T
    : never;
  txMeta: SKTxMeta;
}): Either<string, RawTransaction> =>
  Either.encase(() => {
    const registry = new TypeRegistry();
    registry.setMetadata(
      registry.createType("Metadata", payload.tx.metadataRpc)
    );

    const extrinsic = registry.createType(
      "Extrinsic",
      { method: payload.tx.method },
      { version: payload.tx.version }
    );
    const humanMethod = extrinsic.method.toHuman() as SubstrateHumanMethod;
    const args = formatSubstrateArgs(humanMethod.args);
    const fee = getFeeInBaseUnits(gasEstimate);
    const recipient = payload.tx.address;

    const ledgerTx = (() => {
      switch (humanMethod.method) {
        case "bond":
          return {
            mode: "bond",
            family: "polkadot",
            amount: readString(args.value, txMeta.amountRaw),
            recipient,
            fee: fee.toString(),
            rewardDestination: readOptionalString(args.payee),
          };
        case "bondExtra":
          return {
            mode: "bond",
            family: "polkadot",
            amount: readString(args.maxAdditional),
            recipient,
            fee: fee.toString(),
            rewardDestination: "Stash",
          };
        case "unbond":
          return {
            mode: "unbond",
            family: "polkadot",
            amount: readString(args.value, txMeta.amountRaw),
            recipient,
            fee: fee.toString(),
          };
        case "nominate":
          return {
            mode: "nominate",
            family: "polkadot",
            amount: "0",
            recipient,
            fee: fee.toString(),
            validators: readValidatorTargets(args.targets),
          };
        case "chill":
          return {
            mode: "chill",
            family: "polkadot",
            amount: "0",
            recipient,
            fee: fee.toString(),
          };
        case "rebond":
          return {
            mode: "rebond",
            family: "polkadot",
            amount: readString(args.value, txMeta.amountRaw),
            recipient,
            fee: fee.toString(),
          };
        case "withdrawUnbonded":
          return {
            mode: "withdrawUnbonded",
            family: "polkadot",
            amount: readString(args.value, "0"),
            recipient,
            numOfSlashingSpans: Number(
              readString(args.numOfSlashingSpans, "0")
            ),
            fee: fee.toString(),
          };
        default:
          throw new Error(
            `Unsupported Polkadot Ledger method: ${humanMethod.method}`
          );
      }
    })();

    return ledgerTx as RawTransaction;
  }).mapLeft((error) =>
    error instanceof Error ? error.message : "Invalid Polkadot transaction"
  );

const buildCosmosLedgerTransaction = (
  txMeta: SKTxMeta
): Either<string, RawTransaction> => {
  const validatorAddress = txMeta.rawArguments?.validatorAddress;
  const mode = getCosmosMode(txMeta.txType);
  const actionAmount = getActionAmountInBaseUnits(txMeta);
  const amount =
    actionAmount ?? (isCosmosClaimMode(mode) ? new BigNumber(0) : null);

  if (!validatorAddress || amount === null) {
    return Left("Missing Cosmos Ledger arguments");
  }

  return Right({
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
): Either<string, RawTronTransaction> => {
  const amount = getActionAmountInBaseUnits(txMeta);
  const resource = txMeta.rawArguments?.tronResource;
  const validatorAddress =
    txMeta.rawArguments?.validatorAddress ??
    txMeta.rawArguments?.validatorAddresses?.[0];

  const tronLedgerTx = (() => {
    switch (txMeta.txType) {
      case "FREEZE_BANDWIDTH":
      case "FREEZE_ENERGY":
        if (!amount || !resource) return Left("Missing Tron freeze arguments");
        return Right({
          amount: amount.toString(),
          recipient: txMeta.address ?? "",
          family: "tron",
          mode: "freeze",
          resource,
        } as RawTronTransaction);
      case "VOTE": {
        const validatorAddresses = txMeta.rawArguments?.validatorAddresses;

        if (!amount || !validatorAddresses?.length) {
          return Left("Missing Tron vote arguments");
        }

        return getTronVotes({
          txMeta,
          validatorAddresses,
        }).map(
          (votes) =>
            ({
              amount: amount.toString(),
              recipient: txMeta.address ?? "",
              family: "tron",
              mode: "vote",
              votes,
            }) as RawTronTransaction
        );
      }
      case "UNDELEGATE_BANDWIDTH":
      case "UNDELEGATE_ENERGY":
        if (!amount || !resource || !validatorAddress) {
          return Left("Missing Tron undelegate arguments");
        }
        return Right({
          amount: amount.toString(),
          recipient: validatorAddress,
          family: "tron",
          mode: "unDelegateResource",
          resource,
        } as RawTronTransaction);
      case "UNFREEZE_LEGACY_BANDWIDTH":
      case "UNFREEZE_LEGACY_ENERGY":
        return Right({
          amount: "0",
          recipient: "",
          family: "tron",
          mode: "legacyUnfreeze",
          resource,
        } as RawTronTransaction);
      case "UNFREEZE_BANDWIDTH":
      case "UNFREEZE_ENERGY":
        if (!amount || !resource)
          return Left("Missing Tron unfreeze arguments");
        return Right({
          amount: amount.toString(),
          recipient: txMeta.address ?? "",
          family: "tron",
          mode: "unfreeze",
          resource,
        } as RawTronTransaction);
      case "CLAIM_REWARDS":
        return Right({
          amount: "0",
          recipient: txMeta.address ?? "",
          family: "tron",
          mode: "claimReward",
        } as RawTronTransaction);
      default:
        return Left(
          `Unsupported Tron Ledger transaction type: ${txMeta.txType}`
        );
    }
  })();

  return tronLedgerTx.map((tx) => ({ ...tx, votes: tx.votes ?? [] }));
};

const buildNearLedgerTransaction = (
  txMeta: SKTxMeta
): Either<string, RawTransaction> => {
  const validatorAddress = txMeta.rawArguments?.validatorAddress;
  const amount = getActionAmountInBaseUnits(txMeta);

  if (!validatorAddress || !amount) {
    return Left("Missing Near Ledger arguments");
  }

  return Right({
    amount: amount.toString(),
    recipient: validatorAddress,
    family: "near",
    mode: getNearMode(txMeta.txType),
    fees: getFeeInBaseUnits(parseGasEstimate(txMeta.gasEstimate)).toString(),
  } as RawTransaction);
};

const buildTezosLedgerTransaction = (
  txMeta: SKTxMeta
): Either<string, RawTransaction> => {
  const gasEstimate = parseGasEstimate(txMeta.gasEstimate);
  const isUnstake = txMeta.txType === "UNSTAKE";
  const recipient = isUnstake ? "" : txMeta.rawArguments?.validatorAddress;

  if (!isUnstake && !recipient) {
    return Left("Missing Tezos Ledger validator");
  }

  return Right({
    family: "tezos",
    mode: isUnstake ? "undelegate" : "delegate",
    amount: "0",
    recipient: recipient ?? "",
    fees: getFeeInBaseUnits(gasEstimate).toString(),
    gasLimit: String(gasEstimate?.gasLimit ?? 0),
  } as RawTransaction);
};

const buildTonLedgerTransaction = (
  tx: ReturnType<typeof unsignedTonTransactionCodec.decode> extends Either<
    string,
    infer T
  >
    ? T
    : never,
  txMeta: SKTxMeta
): Either<string, RawTransaction> => {
  const gasEstimate = parseGasEstimate(txMeta.gasEstimate);

  if (Array.isArray(tx)) {
    const firstMessage = tx[0];

    if (!firstMessage) {
      return Left("Unsupported Ton Ledger transaction payload");
    }

    return Right({
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

  return Either.encase(() => {
    const parsedTx = loadMessageRelaxed(
      Cell.fromBase64(tx.message).beginParse()
    );
    const info = parsedTx.info as CommonMessageInfoRelaxedInternal;

    return {
      family: "ton",
      amount: info.value.coins.toString(),
      recipient: info.dest.toString(),
      fees: getFeeInBaseUnits(gasEstimate).toString(),
      comment: {
        text: parsedTx.body.toBoc().toString("base64"),
        isEncrypted: false,
      },
    } as RawTransaction;
  }).mapLeft(() => "Unsupported Ton Ledger transaction payload");
};

const isCosmosNetwork = (network: string): network is CosmosNetworks =>
  Object.values(CosmosNetworks).includes(network as CosmosNetworks);

const parseGasEstimate = (
  gasEstimate: SKTxMeta["gasEstimate"]
): GasEstimate => {
  if (!gasEstimate) return null;

  return Either.encase(() => JSON.parse(gasEstimate) as GasEstimate).orDefault(
    null
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

const formatSubstrateArgs = (
  args: Record<string, unknown> | null
): Record<string, unknown> => {
  if (!args) return {};

  return Object.entries(args).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      acc[toCamelCase(key)] = normalizeSubstrateValue(value);

      return acc;
    },
    {}
  );
};

const normalizeSubstrateValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeSubstrateValue);
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "");

    return isNumericString(normalized) ? normalized : value;
  }

  if (typeof value === "object" && value !== null) {
    return formatSubstrateArgs(value as Record<string, unknown>);
  }

  return value;
};

const toCamelCase = (key: string): string =>
  key.includes("-") || key.includes("_")
    ? key
        .toLowerCase()
        .replace(/([-_][a-z])/g, (group) =>
          group.toUpperCase().replace("-", "").replace("_", "")
        )
    : key;

const isNumericString = (value: string): boolean =>
  /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value.trim());

const readString = (
  value: unknown,
  fallback: string | null | undefined = undefined
): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }
  if (fallback) return fallback;

  return "0";
};

const readOptionalString = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }

  return undefined;
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
}): Either<string, { address: string; voteCount: number }[]> => {
  const amount = getActionAmountInTokenUnits(txMeta);

  if (!amount) {
    return Left("Missing Tron vote arguments");
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
    return Left("Invalid Tron vote count");
  }

  if (equalVoteCount.plus(1).gt(Number.MAX_SAFE_INTEGER)) {
    return Left("Tron vote count exceeds Ledger limits");
  }

  return Right(
    validatorAddresses.map((address, index) => ({
      address,
      voteCount: equalVoteCount
        .plus(index < remainingVotes.toNumber() ? 1 : 0)
        .toNumber(),
    }))
  );
};

const readValidatorTargets = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (typeof item === "object" && item !== null && "Id" in item) {
      const id = (item as { Id?: unknown }).Id;
      return typeof id === "string" ? [id] : [];
    }
    if (typeof item === "object" && item !== null && "id" in item) {
      const id = (item as { id?: unknown }).id;
      return typeof id === "string" ? [id] : [];
    }

    return [];
  });
};
