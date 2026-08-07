import type { RawTransaction } from "@ledgerhq/wallet-api-core";
import { TypeRegistry } from "@polkadot/types";
import { Result } from "effect";
import type { substratePayloadCodec } from "../../../../domain/types/transaction";
import type { SKTxMeta } from "../../../../public-api/types";

type SubstrateHumanMethod = {
  section: string;
  method: string;
  args: Record<string, unknown> | null;
};

export type BuildPolkadotLedgerTransaction = (params: {
  fee: string;
  payload: typeof substratePayloadCodec.Type;
  txMeta: SKTxMeta;
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
    const humanMethod = extrinsic.method.toHuman() as SubstrateHumanMethod;
    const args = formatSubstrateArgs(humanMethod.args);
    const recipient = payload.tx.address;

    const ledgerTx = (() => {
      switch (humanMethod.method) {
        case "bond":
          return {
            mode: "bond",
            family: "polkadot",
            amount: readString(args.value, txMeta.amountRaw),
            recipient,
            fee,
            rewardDestination: readOptionalString(args.payee),
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
          throw new Error(
            `Unsupported Polkadot Ledger method: ${humanMethod.method}`
          );
      }
    })();

    return Result.succeed(ledgerTx as RawTransaction);
  } catch (error) {
    return Result.fail(
      error instanceof Error ? error.message : "Invalid Polkadot transaction"
    );
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
