import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import {
  HttpRequestError,
  InvalidInputRpcError,
  TransactionNotFoundError,
  WaitForTransactionReceiptTimeoutError,
} from "viem";
import { vi } from "vitest";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import { EvmRpc } from "../../src/services/evm-rpc/evm-rpc";
import { makeConnectedWalletState } from "../fixtures/wallet-state";
import { makeTestWallet } from "../utils/services/wallet-service";

const rpc = vi.hoisted(() => ({
  getTransaction: vi.fn(),
  sendRawTransaction: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));

vi.mock("viem/actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("viem/actions")>()),
  getTransaction: rpc.getTransaction,
  sendRawTransaction: rpc.sendRawTransaction,
  waitForTransactionReceipt: rpc.waitForTransactionReceipt,
}));

const hash = `0x${"ab".repeat(32)}` as const;
const owner = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

const provideEvmRpc = <A, E>(effect: Effect.Effect<A, E, EvmRpc>) =>
  Effect.gen(function* () {
    const wallet = yield* makeTestWallet({
      initialState: makeConnectedWalletState(
        new WalletScopeKey({ address: owner, network: "ethereum" })
      ),
      wagmiConfig: { chains: [], getClient: () => ({}) } as never,
    });
    return yield* effect.pipe(
      Effect.provide(EvmRpc.layer.pipe(Layer.provide(wallet.layer)))
    );
  });

const timeout = () =>
  Promise.reject(new WaitForTransactionReceiptTimeoutError({ hash }));

describe("EvmRpc", () => {
  it.effect(
    "treats a rejected rebroadcast the node already holds as sent",
    () =>
      provideEvmRpc(
        Effect.gen(function* () {
          rpc.sendRawTransaction.mockRejectedValueOnce(
            new Error("already known")
          );
          rpc.getTransaction.mockResolvedValueOnce({ hash });
          const rpcService = yield* EvmRpc;

          yield* rpcService.broadcast({ chainId: 1, hash, signedTx: "0x02aa" });

          expect(rpc.getTransaction).toHaveBeenCalledWith(expect.anything(), {
            hash,
          });
        })
      )
  );

  it.effect("reports a broadcast the node refused and does not hold", () =>
    provideEvmRpc(
      Effect.gen(function* () {
        rpc.sendRawTransaction.mockRejectedValueOnce(
          new InvalidInputRpcError(new Error("underpriced"))
        );
        rpc.getTransaction.mockRejectedValueOnce(
          new TransactionNotFoundError({ hash })
        );
        const rpcService = yield* EvmRpc;

        const error = yield* rpcService
          .broadcast({ chainId: 1, hash, signedTx: "0x02aa" })
          .pipe(Effect.flip);

        expect(error._tag).toBe("EvmBroadcastRejectedError");
      })
    )
  );

  it.effect(
    "keeps a broadcast whose delivery failed ambiguous even if the node lacks it",
    () =>
      provideEvmRpc(
        Effect.gen(function* () {
          rpc.sendRawTransaction.mockRejectedValueOnce(
            new HttpRequestError({ url: "https://rpc.test" })
          );
          rpc.getTransaction.mockRejectedValueOnce(
            new TransactionNotFoundError({ hash })
          );
          const rpcService = yield* EvmRpc;

          const error = yield* rpcService
            .broadcast({ chainId: 1, hash, signedTx: "0x02aa" })
            .pipe(Effect.flip);

          expect(error._tag).toBe("EvmRpcError");
        })
      )
  );

  it.effect(
    "does not call a broadcast refused when the node could not be asked",
    () =>
      provideEvmRpc(
        Effect.gen(function* () {
          rpc.sendRawTransaction.mockRejectedValueOnce(new Error("timeout"));
          rpc.getTransaction.mockRejectedValueOnce(new Error("timeout"));
          const rpcService = yield* EvmRpc;

          const error = yield* rpcService
            .broadcast({ chainId: 1, hash, signedTx: "0x02aa" })
            .pipe(Effect.flip);

          expect(error._tag).toBe("EvmRpcError");
        })
      )
  );

  it.effect(
    "reports a transaction the node lost after the timeout as dropped",
    () =>
      provideEvmRpc(
        Effect.gen(function* () {
          rpc.waitForTransactionReceipt.mockImplementationOnce(timeout);
          rpc.getTransaction.mockRejectedValueOnce(
            new TransactionNotFoundError({ hash })
          );
          const rpcService = yield* EvmRpc;

          expect(yield* rpcService.awaitOutcome({ chainId: 1, hash })).toBe(
            "Dropped"
          );
        })
      )
  );

  it.effect("keeps waiting on a pending transaction after the timeout", () =>
    provideEvmRpc(
      Effect.gen(function* () {
        rpc.waitForTransactionReceipt.mockImplementationOnce(timeout);
        rpc.getTransaction.mockResolvedValueOnce({ hash });
        const rpcService = yield* EvmRpc;

        const error = yield* rpcService
          .awaitOutcome({ chainId: 1, hash })
          .pipe(Effect.flip);

        expect(error.operation).toBe("wait-receipt");
      })
    )
  );

  it.effect("reports a reverted receipt", () =>
    provideEvmRpc(
      Effect.gen(function* () {
        rpc.waitForTransactionReceipt.mockResolvedValueOnce({
          status: "reverted",
        });
        const rpcService = yield* EvmRpc;

        expect(yield* rpcService.awaitOutcome({ chainId: 1, hash })).toBe(
          "Reverted"
        );
      })
    )
  );
});
