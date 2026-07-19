import { Effect, Fiber } from "effect";
import { type Hash, type Hex, zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import {
  WagmiOperations,
  WagmiOperationsError,
  type WagmiOperationsService,
} from "../../../src/services/wallet/platform/wagmi-operations";
import { makeWagmiActions } from "../../../src/services/wallet/wagmi-actions";

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
  switchChain: vi.fn(() => Effect.succeed(mainnet)),
});

const operationFailure = (cause: unknown) =>
  new WagmiOperationsError({ cause, operation: "connect" });

const makeCommands = (
  config: ReturnType<typeof makeConfig>,
  operations: WagmiOperationsService
) =>
  Effect.runPromise(
    makeWagmiActions({ config }).pipe(
      Effect.provideService(WagmiOperations, WagmiOperations.of(operations))
    )
  );

describe("Wagmi actions", () => {
  it("uses the exact controller config for every core action", async () => {
    const config = makeConfig();
    const operations = makeOperations();
    const commands = await makeCommands(config, operations);

    await Effect.runPromise(commands.connect({ connector }));
    await Effect.runPromise(commands.disconnect({ connector }));
    await Effect.runPromise(commands.reconnect({ connectors: [connector] }));
    await Effect.runPromise(commands.switchChain({ chainId: mainnet.id }));
    await Effect.runPromise(commands.signMessage({ message: "hello" }));
    await Effect.runPromise(
      commands.sendEvmTransaction({
        data: "0x",
        gasPrice: 1n,
        to: zeroAddress,
        type: "legacy",
      })
    );

    for (const operation of Object.values(operations)) {
      expect(operation).toHaveBeenCalledWith(config, expect.anything());
    }
  });

  it("preserves action results and normalizes broadcast results", async () => {
    const commands = await makeCommands(makeConfig(), makeOperations());

    await expect(
      Effect.runPromise(commands.connect({ connector }))
    ).resolves.toEqual({
      accounts: [zeroAddress],
      chainId: mainnet.id,
    });
    await expect(
      Effect.runPromise(
        commands.sendEvmTransaction({
          maxFeePerGas: 2n,
          maxPriorityFeePerGas: 1n,
          to: zeroAddress,
          type: "eip1559",
        })
      )
    ).resolves.toEqual({
      broadcasted: true,
      signedTx: `0x${"1".repeat(64)}`,
    });
  });

  it("uses the current Wagmi connection for EVM wallet actions", async () => {
    const operations = makeOperations();
    const commands = await makeCommands(makeConfig(), operations);

    await Effect.runPromise(
      commands.sendEvmTransaction({
        connector,
        gasPrice: 1n,
        to: zeroAddress,
        type: "legacy",
      })
    );
    await Effect.runPromise(
      commands.signMessage({ connector, message: "hello" })
    );

    expect(operations.sendTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ connector: undefined })
    );
    expect(operations.signMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ connector: undefined })
    );
  });

  it("maps platform failures by operation", async () => {
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
    const commands = await makeCommands(makeConfig(), operations);

    const failures = await Promise.all([
      Effect.runPromise(Effect.flip(commands.connect({ connector }))),
      Effect.runPromise(
        Effect.flip(commands.switchChain({ chainId: mainnet.id }))
      ),
      Effect.runPromise(
        Effect.flip(commands.signMessage({ message: "hello" }))
      ),
      Effect.runPromise(
        Effect.flip(
          commands.sendEvmTransaction({
            gasPrice: 1n,
            to: zeroAddress,
            type: "legacy",
          })
        )
      ),
    ]);

    expect(failures.map((failure) => failure._tag)).toEqual([
      "WalletConnectionError",
      "WalletSwitchError",
      "WalletSigningError",
      "WalletBroadcastError",
    ]);
    expect(failures.every((failure) => failure.cause === cause)).toBe(true);
  });

  it("does not publish a late result from an interrupted wallet operation", async () => {
    let resolve!: (value: Hex) => void;
    let published = false;
    const operations = makeOperations();
    vi.mocked(operations.signMessage).mockImplementation(() =>
      Effect.callback<Hex, WagmiOperationsError>((resume) => {
        resolve = (value) => resume(Effect.succeed(value));
      })
    );
    const commands = await makeCommands(makeConfig(), operations);
    const fiber = Effect.runFork(
      commands.signMessage({ message: "hello" }).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            published = true;
          })
        )
      )
    );

    await vi.waitFor(() => expect(operations.signMessage).toHaveBeenCalled());
    await Effect.runPromise(Fiber.interrupt(fiber));
    resolve("0xlate" as Hex);
    await Promise.resolve();
    await Promise.resolve();

    expect(published).toBe(false);
  });
});
