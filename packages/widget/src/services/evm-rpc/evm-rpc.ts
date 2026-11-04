import { Context, Data, Duration, Effect, Layer } from "effect";
import {
  BaseError,
  erc20Abi,
  type Hex,
  numberToHex,
  RpcError,
  RpcRequestError,
  TransactionNotFoundError,
  WaitForTransactionReceiptTimeoutError,
} from "viem";
import {
  estimateFeesPerGas,
  estimateGas,
  getTransaction,
  readContract,
  sendRawTransaction,
  waitForTransactionReceipt,
} from "viem/actions";
import type { Erc20Approval } from "../../domain/action/direct-transaction";
import type { EvmChainIds } from "../../domain/wallet/chain-ids";
import { WalletService } from "../wallet/wallet-service";

export class EvmRpcError extends Data.TaggedError("EvmRpcError")<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

/** The node refused a broadcast and does not hold the transaction. */
export class EvmBroadcastRejectedError extends Data.TaggedError(
  "EvmBroadcastRejectedError"
)<{
  readonly cause: unknown;
}> {}

/** How a broadcast transaction ended; a dropped one was never mined. */
type EvmTransactionOutcome = "Confirmed" | "Dropped" | "Reverted";

type EvmRpcApi = Readonly<{
  /** The unsigned EIP-1559 transaction a wallet signs, gas and fees estimated. */
  readonly prepare: (input: {
    readonly chainId: EvmChainIds;
    readonly data: Hex;
    readonly from: Hex;
    readonly to: Hex;
  }) => Effect.Effect<string, EvmRpcError>;
  /**
   * Broadcasts `signedTx`; one the node already knows counts as broadcast.
   * Only an error the node answered while not holding it is a rejection.
   */
  readonly broadcast: (input: {
    readonly chainId: EvmChainIds;
    readonly hash: Hex;
    readonly signedTx: Hex;
  }) => Effect.Effect<void, EvmBroadcastRejectedError | EvmRpcError>;
  readonly awaitOutcome: (input: {
    readonly chainId: EvmChainIds;
    readonly hash: Hex;
  }) => Effect.Effect<EvmTransactionOutcome, EvmRpcError>;
  readonly explorerUrl: (input: {
    readonly chainId: EvmChainIds;
    readonly hash: Hex;
  }) => string | null;
  /** How much of `token` `owner` currently lets `spender` move. */
  readonly readAllowance: (
    input: Omit<Erc20Approval, "amount"> & { readonly chainId: EvmChainIds }
  ) => Effect.Effect<bigint, EvmRpcError>;
}>;

/** Long enough for a congested chain; past it, an unknown hash was dropped. */
const receiptTimeout = Duration.minutes(5);

const tryRpc = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new EvmRpcError({ cause, operation }),
  });

/** EVM reads and broadcasts for transactions the widget builds itself. */
export class EvmRpc extends Context.Service<EvmRpc, EvmRpcApi>()(
  "stakekit/widget/EvmRpc"
) {
  static readonly layer = Layer.effect(
    EvmRpc,
    Effect.gen(function* () {
      const { wagmiConfig } = yield* WalletService;
      // Wagmi types one client per configured chain; a number reads the common client.
      const clientFor = (chainId: number) =>
        Effect.try({
          try: () => wagmiConfig.getClient({ chainId }),
          catch: (cause) => new EvmRpcError({ cause, operation: "client" }),
        });

      return {
        readAllowance: ({ chainId, owner, spender, token }) =>
          clientFor(chainId).pipe(
            Effect.flatMap((client) =>
              tryRpc("read-allowance", () =>
                readContract(client, {
                  abi: erc20Abi,
                  address: token,
                  args: [owner, spender],
                  functionName: "allowance",
                })
              )
            )
          ),
        awaitOutcome: ({ chainId, hash }) =>
          Effect.gen(function* () {
            const client = yield* clientFor(chainId);
            return yield* tryRpc("wait-receipt", () =>
              waitForTransactionReceipt(client, {
                hash,
                timeout: Duration.toMillis(receiptTimeout),
              })
            ).pipe(
              Effect.map(
                ({ status }): EvmTransactionOutcome =>
                  status === "success" ? "Confirmed" : "Reverted"
              ),
              // Past the timeout, a hash the node no longer knows was dropped.
              Effect.catchIf(
                (error) =>
                  error.cause instanceof WaitForTransactionReceiptTimeoutError,
                (error) =>
                  tryRpc("get-transaction", () =>
                    getTransaction(client, { hash })
                  ).pipe(
                    Effect.matchEffect({
                      onFailure: (probe) =>
                        probe.cause instanceof TransactionNotFoundError
                          ? Effect.succeed("Dropped" as const)
                          : Effect.fail(error),
                      onSuccess: () => Effect.fail(error),
                    })
                  )
              )
            );
          }),
        broadcast: ({ chainId, hash, signedTx }) =>
          Effect.gen(function* () {
            const client = yield* clientFor(chainId);
            yield* tryRpc("broadcast", () =>
              sendRawTransaction(client, { serializedTransaction: signedTx })
            ).pipe(
              // A retried broadcast the node already accepted is not a failure.
              Effect.catch((error) =>
                tryRpc("get-transaction", () =>
                  getTransaction(client, { hash })
                ).pipe(
                  // Only a node that answered refused it; a transport failure
                  // or timeout may still have delivered it.
                  Effect.mapError((probe) =>
                    probe.cause instanceof TransactionNotFoundError &&
                    error.cause instanceof BaseError &&
                    error.cause.walk(
                      (cause) =>
                        cause instanceof RpcError ||
                        cause instanceof RpcRequestError
                    ) !== null
                      ? new EvmBroadcastRejectedError({ cause: error.cause })
                      : error
                  )
                )
              )
            );
          }),
        explorerUrl: ({ chainId, hash }) => {
          const explorer = wagmiConfig.chains.find(({ id }) => id === chainId)
            ?.blockExplorers?.default.url;
          return explorer ? `${explorer.replace(/\/$/, "")}/tx/${hash}` : null;
        },
        prepare: ({ chainId, data, from, to }) =>
          Effect.gen(function* () {
            const client = yield* clientFor(chainId);
            const [gas, fees] = yield* tryRpc("prepare-transaction", () =>
              Promise.all([
                estimateGas(client, { account: from, data, to }),
                estimateFeesPerGas(client),
              ])
            );
            return JSON.stringify({
              chainId,
              data,
              from,
              gasLimit: numberToHex((gas * 12n) / 10n),
              maxFeePerGas: numberToHex(fees.maxFeePerGas),
              maxPriorityFeePerGas: numberToHex(fees.maxPriorityFeePerGas),
              to,
              type: 2,
            });
          }),
      } satisfies EvmRpcApi;
    })
  );
}
