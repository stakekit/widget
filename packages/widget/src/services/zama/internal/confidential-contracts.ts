import { Effect, Option, Schema } from "effect";
import {
  type Address,
  encodeFunctionData,
  erc20Abi,
  type Hex,
  parseAbi,
  parseEventLogs,
  type TransactionReceipt,
} from "viem";

import {
  type DirectTransaction,
  DirectTransactionId,
  makeErc20Approval,
} from "../../../domain/action/direct-transaction";
import { ConfidentialHandle } from "../../../domain/earn/balance";
import type {
  ConfidentialChainId,
  ConfidentialConversion,
} from "../../../domain/earn/confidential";
import type {
  ContractAddress,
  WalletAddress,
} from "../../../domain/identity/identifiers";
import type { Network } from "../../../domain/network/network";
import type { ZamaSdkAdapter } from "./sdk";
import { toEvmAddress, tryZama } from "./zama-error";

const wrapperAbi = parseAbi([
  "function wrap(address to, uint256 amount) returns (bytes32)",
  "function rate() view returns (uint256)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "event UnwrapRequested(address indexed receiver, bytes32 indexed unwrapRequestId, bytes32 amount)",
]);

/** `amount` of the underlying token in the wrapper's decimals. */
export const readWrappedAmount = Effect.fn("ZamaService.wrappedAmount")(
  function* (
    sdk: ZamaSdkAdapter,
    {
      amount,
      conversion,
    }: {
      readonly amount: bigint;
      readonly conversion: ConfidentialConversion;
    }
  ) {
    const client = yield* sdk.getPublicClient(conversion.chainId);
    const address = yield* toEvmAddress(conversion.wrapper, "read-rate");
    // `rate()` rebases underlying decimals to the wrapper's.
    const rate = yield* tryZama("read-rate", () =>
      client.readContract({
        abi: wrapperAbi,
        address,
        functionName: "rate",
      })
    );
    return amount / rate;
  }
);

/**
 * The approve and wrap that turn `amount` of the underlying token into its
 * confidential wrapper, by the owner's current allowance.
 */
export const planConversion = Effect.fn("ZamaService.planConversion")(
  function* (
    sdk: ZamaSdkAdapter,
    {
      amount,
      conversion,
      network,
      owner,
    }: {
      readonly amount: bigint;
      readonly conversion: ConfidentialConversion;
      readonly network: Network;
      readonly owner: WalletAddress;
    }
  ) {
    // A conversion runs on an EVM chain, so its addresses are hex.
    const allowance = yield* Effect.all({
      owner: toEvmAddress(owner, "plan-conversion"),
      spender: toEvmAddress(conversion.wrapper, "plan-conversion"),
      token: toEvmAddress(conversion.underlying, "plan-conversion"),
    }).pipe(Effect.orDie);
    const approve = (type: "APPROVAL" | "RESET_APPROVAL") =>
      makeErc20Approval({
        amount,
        chainId: conversion.chainId,
        id: DirectTransactionId.make("conversion-approval"),
        network,
        type,
        ...allowance,
      });
    const wrap: DirectTransaction = {
      approval: null,
      chainId: conversion.chainId,
      data: encodeFunctionData({
        abi: wrapperAbi,
        args: [allowance.owner, amount],
        functionName: "wrap",
      }),
      id: DirectTransactionId.make("conversion-wrap"),
      network,
      to: allowance.spender,
      type: "WRAP",
    };
    const current = yield* sdk.getPublicClient(conversion.chainId).pipe(
      Effect.flatMap((client) =>
        tryZama("read-allowance", () =>
          client.readContract({
            abi: erc20Abi,
            address: allowance.token,
            args: [allowance.owner, allowance.spender],
            functionName: "allowance",
          })
        )
      ),
      Effect.option
    );

    if (Option.isSome(current) && current.value >= amount) return [wrap];
    if (Option.isSome(current) && current.value === 0n) {
      return [approve("APPROVAL"), wrap];
    }
    // USDT reverts when changing one non-zero allowance to another, and an
    // unknown allowance may be one: reset it first. Each approval reads the
    // allowance again before signing.
    return [approve("RESET_APPROVAL"), approve("APPROVAL"), wrap];
  }
);

/**
 * How many of `tokens` the owner has not yet made `operator` an operator on;
 * a grant whose status cannot be read counts as missing.
 */
export const countMissingOperatorGrants = Effect.fn(
  "ZamaService.countMissingOperatorGrants"
)(function* (
  sdk: ZamaSdkAdapter,
  {
    chainId,
    operator,
    owner,
    tokens,
  }: {
    readonly chainId: ConfidentialChainId;
    readonly operator: ContractAddress;
    readonly owner: WalletAddress;
    readonly tokens: ReadonlyArray<ContractAddress>;
  }
) {
  const client = yield* sdk.getPublicClient(chainId).pipe(Effect.option);
  if (Option.isNone(client)) return tokens.length;
  const granted = yield* Effect.forEach(
    tokens,
    (token) =>
      Effect.all([
        toEvmAddress(token, "read-operator"),
        toEvmAddress(owner, "read-operator"),
        toEvmAddress(operator, "read-operator"),
      ]).pipe(
        Effect.flatMap(([address, holder, spender]) =>
          tryZama("read-operator", () =>
            client.value.readContract({
              abi: wrapperAbi,
              address,
              args: [holder, spender],
              functionName: "isOperator",
            })
          )
        ),
        Effect.orElseSucceed(() => false)
      ),
    { concurrency: "unbounded" }
  );
  return granted.filter((isGranted) => !isGranted).length;
});

export const readUnwrapReceipt = Effect.fn("ZamaService.readUnwrapReceipt")(
  function* (
    sdk: ZamaSdkAdapter,
    {
      chainId,
      hash,
    }: {
      readonly chainId: ConfidentialChainId;
      readonly hash: Hex;
    }
  ) {
    const client = yield* sdk.getPublicClient(chainId);
    return yield* tryZama("read-unwrap-receipt", () =>
      client.getTransactionReceipt({ hash })
    );
  }
);

/** The unwrap request `receipt`'s transaction opened for `receiver`, if any. */
export const findUnwrapRequest = (
  receipt: TransactionReceipt,
  receiver: Address
): Option.Option<ConfidentialHandle> => {
  const [requested] = parseEventLogs({
    abi: wrapperAbi,
    args: { receiver },
    eventName: "UnwrapRequested",
    logs: receipt.logs,
  });
  return requested
    ? Schema.decodeOption(ConfidentialHandle)(requested.args.unwrapRequestId)
    : Option.none();
};
