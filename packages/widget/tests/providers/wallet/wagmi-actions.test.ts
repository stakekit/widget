import { Effect, Fiber } from "effect";
import { type Hash, type Hex, zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import {
  makeWagmiActions,
  type WagmiActionOperations,
} from "../../../src/services/wallet/wagmi-actions";

const connector = {
  id: "test",
  name: "Test",
  type: "test",
  uid: "test-uid",
} as Parameters<WagmiActionOperations["connect"]>[1]["connector"];

const makeConfig = () =>
  createConfig({
    chains: [mainnet],
    connectors: [],
    transports: { [mainnet.id]: http() },
  });

const makeOperations = (): WagmiActionOperations => ({
  connect: vi.fn(async () => ({
    accounts: [zeroAddress],
    chainId: mainnet.id,
  })),
  disconnect: vi.fn(async () => undefined),
  reconnect: vi.fn(async () => []),
  sendTransaction: vi.fn(async () => `0x${"1".repeat(64)}` as Hash),
  signMessage: vi.fn(async () => "0xsigned" as Hex),
  switchChain: vi.fn(async () => mainnet),
});

describe("Wagmi actions", () => {
  it("uses the exact controller config for every core action", async () => {
    const config = makeConfig();
    const operations = makeOperations();
    const commands = makeWagmiActions({ config, operations });

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
    const commands = makeWagmiActions({
      config: makeConfig(),
      operations: makeOperations(),
    });

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
    const commands = makeWagmiActions({
      config: makeConfig(),
      operations,
    });

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

  it("maps Promise failures by operation", async () => {
    const cause = new Error("rejected");
    const operations = makeOperations();
    vi.mocked(operations.connect).mockRejectedValue(cause);
    vi.mocked(operations.switchChain).mockRejectedValue(cause);
    vi.mocked(operations.signMessage).mockRejectedValue(cause);
    vi.mocked(operations.sendTransaction).mockRejectedValue(cause);
    const commands = makeWagmiActions({
      config: makeConfig(),
      operations,
    });

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

  it("does not publish a late result from an interrupted wallet Promise", async () => {
    let resolve!: (value: Hex) => void;
    let published = false;
    const operations = makeOperations();
    vi.mocked(operations.signMessage).mockImplementation(
      () => new Promise((resume) => (resolve = resume))
    );
    const commands = makeWagmiActions({
      config: makeConfig(),
      operations,
    });
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
