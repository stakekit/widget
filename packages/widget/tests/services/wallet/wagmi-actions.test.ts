import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { type Hash, type Hex, zeroAddress } from "viem";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";

import {
  WagmiOperations,
  WagmiOperationsError,
  type WagmiOperationsService,
} from "../../../src/services/wallet/internal/platform/wagmi-operations";
import { makeWagmiActions } from "../../../src/services/wallet/internal/runtime/wagmi-actions";

const connector = {
  id: "test",
  name: "Test",
  type: "test",
  uid: "test-uid",
} as Parameters<WagmiOperationsService["connect"]>[1]["connector"];

const makeConfig = () =>
  createConfig({
    chains: [mainnet],
    connectors: [],
    transports: { [mainnet.id]: http() },
  });

const makeOperations = (): WagmiOperationsService => ({
  connect: vi.fn(() =>
    Effect.succeed({
      accounts: [zeroAddress],
      chainId: mainnet.id,
    })
  ),
  disconnect: vi.fn(() => Effect.void),
  reconnect: vi.fn(() => Effect.succeed([])),
  sendTransaction: vi.fn(() => Effect.succeed(`0x${"1".repeat(64)}` as Hash)),
  signMessage: vi.fn(() => Effect.succeed("0xsigned" as Hex)),
  signTypedData: vi.fn(() => Effect.succeed("0xtyped" as Hex)),
  switchChain: vi.fn(() => Effect.succeed(mainnet)),
});

const operationFailure = (cause: unknown) =>
  new WagmiOperationsError({ cause, operation: "connect" });

const makeCommands = (
  config: ReturnType<typeof makeConfig>,
  operations: WagmiOperationsService
) =>
  makeWagmiActions.pipe(
    Effect.map((build) => build({ config })),
    Effect.provideService(WagmiOperations, WagmiOperations.of(operations))
  );

describe("Wagmi actions", () => {
  it.effect("normalizes broadcast results", () =>
    Effect.gen(function* () {
      const commands = yield* makeCommands(makeConfig(), makeOperations());

      expect(
        yield* commands.sendEvmTransaction({
          maxFeePerGas: 2n,
          maxPriorityFeePerGas: 1n,
          to: zeroAddress,
          type: "eip1559",
        })
      ).toEqual({
        broadcasted: true,
        signedTx: `0x${"1".repeat(64)}`,
      });
    })
  );

  it.effect("uses the current Wagmi connection for EVM wallet actions", () =>
    Effect.gen(function* () {
      const operations = makeOperations();
      const commands = yield* makeCommands(makeConfig(), operations);

      yield* commands.sendEvmTransaction({
        connector,
        gasPrice: 1n,
        to: zeroAddress,
        type: "legacy",
      });
      yield* commands.signMessage({ connector, message: "hello" });

      expect(operations.sendTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ connector: undefined })
      );
      expect(operations.signMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ connector: undefined })
      );
    })
  );

  it.effect("maps platform failures by operation", () =>
    Effect.gen(function* () {
      const cause = new Error("rejected");
      const operations = makeOperations();
      vi.mocked(operations.connect).mockReturnValue(
        Effect.fail(operationFailure(cause))
      );
      vi.mocked(operations.switchChain).mockReturnValue(
        Effect.fail(operationFailure(cause))
      );
      vi.mocked(operations.signMessage).mockReturnValue(
        Effect.fail(operationFailure(cause))
      );
      vi.mocked(operations.sendTransaction).mockReturnValue(
        Effect.fail(operationFailure(cause))
      );
      const commands = yield* makeCommands(makeConfig(), operations);

      const failures = yield* Effect.all(
        [
          Effect.flip(commands.connect({ connector })),
          Effect.flip(commands.switchChain({ chainId: mainnet.id })),
          Effect.flip(commands.signMessage({ message: "hello" })),
          Effect.flip(
            commands.sendEvmTransaction({
              gasPrice: 1n,
              to: zeroAddress,
              type: "legacy",
            })
          ),
        ],
        { concurrency: "unbounded" }
      );

      expect(failures.map((failure) => failure._tag)).toEqual([
        "WalletConnectionError",
        "WalletSwitchError",
        "WalletSigningError",
        "WalletBroadcastError",
      ]);
      expect(failures.every((failure) => failure.cause === cause)).toBe(true);
    })
  );
});
