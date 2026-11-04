import type {
  RawPolkadotTransaction,
  RawTransaction,
} from "@ledgerhq/wallet-api-core";
import { TypeRegistry } from "@polkadot/types";
import { Option, Result, Schema } from "effect";
import type { YieldTransactionMeta } from "../../../wallet-transactions";
import type { substratePayloadCodec } from "../substrate/transaction";

const SubstrateHumanMethod = Schema.Struct({
  method: Schema.String,
  args: Schema.optional(
    Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))
  ),
});

const PolkadotRewardDestination = Schema.Literals([
  "None",
  "Staked",
  "Stash",
  "Controller",
  "Account",
]);

export type BuildPolkadotLedgerTransaction = (params: {
  fee: string;
  payload: typeof substratePayloadCodec.Type;
  txMeta: YieldTransactionMeta;
}) => Result.Result<RawTransaction, string>;

/**
 * Decoding a Polkadot extrinsic needs `@polkadot/types`, whose evaluation
 * inflates a large network registry. This module is reached only through a
 * dynamic import from the Ledger Live transaction preparer, so hosts that never
 * submit a Polkadot transaction never pay for it.
 */
export const buildPolkadotLedgerTransaction: BuildPolkadotLedgerTransaction = ({
  fee,
  payload,
  txMeta,
}) => {
  try {
    const registry = new TypeRegistry();
    registry.setMetadata(
      registry.createType("Metadata", payload.tx.metadataRpc)
    );

    const extrinsic = registry.createType(
      "Extrinsic",
      { method: payload.tx.method },
      { version: payload.tx.version }
    );
    const humanMethod = Schema.decodeUnknownOption(SubstrateHumanMethod)(
      extrinsic.method.toHuman()
    );
    if (Option.isNone(humanMethod)) {
      return Result.fail("Invalid Polkadot transaction");
    }
    const { method } = humanMethod.value;
    const args = formatSubstrateArgs(humanMethod.value.args ?? null);
    const recipient = payload.tx.address;

    const ledgerTx = ((): RawPolkadotTransaction => {
      switch (method) {
        case "bond":
          return {
            mode: "bond",
            family: "polkadot",
            amount: readString(args.value, txMeta.amountRaw),
            recipient,
            fee,
            rewardDestination: Schema.decodeUnknownOption(
              PolkadotRewardDestination
            )(args.payee).pipe(Option.getOrUndefined),
          };
        case "bondExtra":
          return {
            mode: "bond",
            family: "polkadot",
            amount: readString(args.maxAdditional),
            recipient,
            fee,
            rewardDestination: "Stash",
          };
        case "unbond":
          return {
            mode: "unbond",
            family: "polkadot",
            amount: readString(args.value, txMeta.amountRaw),
            recipient,
            fee,
          };
        case "nominate":
          return {
            mode: "nominate",
            family: "polkadot",
            amount: "0",
            recipient,
            fee,
            validators: readValidatorTargets(args.targets),
          };
        case "chill":
          return {
            mode: "chill",
            family: "polkadot",
            amount: "0",
            recipient,
            fee,
          };
        case "rebond":
          return {
            mode: "rebond",
            family: "polkadot",
            amount: readString(args.value, txMeta.amountRaw),
            recipient,
            fee,
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
            fee,
          };
        default:
          throw new Error(`Unsupported Polkadot Ledger method: ${method}`);
      }
    })();

    return Result.succeed(ledgerTx);
  } catch (error) {
    return Result.fail(
      error instanceof Error ? error.message : "Invalid Polkadot transaction"
    );
  }
};

const formatSubstrateArgs = (args: object | null): Record<string, unknown> => {
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
    return formatSubstrateArgs(value);
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

const readValidatorTargets = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (typeof item === "object" && item !== null && "Id" in item) {
      return typeof item.Id === "string" ? [item.Id] : [];
    }
    if (typeof item === "object" && item !== null && "id" in item) {
      return typeof item.id === "string" ? [item.id] : [];
    }

    return [];
  });
};
