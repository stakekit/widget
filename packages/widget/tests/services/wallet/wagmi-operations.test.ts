import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import type { Address } from "viem";
import { mainnet } from "viem/chains";
import {
  type CreateConnectorFn,
  createConfig,
  createConnector,
  http,
} from "wagmi";
import { getConnection } from "wagmi/actions";
import { mock } from "wagmi/connectors";
import {
  ownWagmiConnections,
  wagmiOperations,
} from "../../../src/services/wallet/internal/platform/wagmi-operations";

const firstAddress = "0x0000000000000000000000000000000000000001";
const secondAddress = "0x0000000000000000000000000000000000000002";
const changedAddress = "0x0000000000000000000000000000000000000003";

const pendingConnector = (id: string, address: Address) => {
  const approval = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const settled = Promise.withResolvers<void>();
  const connector = createConnector((config) => {
    const base = mock({ accounts: [address] })(config);
    return {
      ...base,
      id,
      name: id,
      async connect(parameters) {
        started.resolve();
        try {
          await approval.promise;
          return await base.connect(parameters);
        } finally {
          settled.resolve();
        }
      },
    };
  });
  return { approval, connector, settled, started };
};

const makeConfig = (...connectors: CreateConnectorFn[]) =>
  createConfig({
    chains: [mainnet],
    connectors,
    multiInjectedProviderDiscovery: false,
    storage: null,
    transports: { [mainnet.id]: http() },
  });

describe("Wagmi connection ownership", () => {
  it.effect(
    "ignores abandoned approval and provider events after another wallet connects",
    () =>
      Effect.gen(function* () {
        const native = pendingConnector("native", firstAddress);
        const config = makeConfig(
          native.connector,
          mock({ accounts: [secondAddress] })
        );
        const first = config.connectors[0]!;
        const second = config.connectors[1]!;
        const pending = yield* wagmiOperations
          .connect(config, { connector: first })
          .pipe(Effect.forkChild({ startImmediately: true }));
        yield* Effect.promise(() => native.started.promise);
        yield* Fiber.interrupt(pending);
        expect(getConnection(config).status).toBe("disconnected");

        yield* wagmiOperations.connect(config, { connector: second });
        native.approval.resolve();
        yield* Effect.promise(() => native.settled.promise);
        first.emitter.emit("connect", { accounts: [firstAddress], chainId: 1 });
        first.emitter.emit("change", {
          accounts: [changedAddress],
          chainId: 1,
        });
        first.emitter.emit("disconnect");
        expect(getConnection(config)).toMatchObject({
          address: secondAddress,
          connector: { uid: second.uid },
          status: "connected",
        });
        expect(config.state.connections.has(first.uid)).toBe(false);

        second.emitter.emit("change", { accounts: [changedAddress] });
        expect(getConnection(config).address).toBe(changedAddress);
        second.emitter.emit("disconnect");
        first.emitter.emit("connect", { accounts: [firstAddress], chainId: 1 });
        expect(getConnection(config).status).toBe("disconnected");
      })
  );

  it.effect(
    "does not commit an approval that settles as the connection is interrupted",
    () =>
      Effect.gen(function* () {
        const native = pendingConnector("native", firstAddress);
        const config = makeConfig(native.connector);
        const pending = yield* wagmiOperations
          .connect(config, { connector: config.connectors[0]! })
          .pipe(Effect.forkChild({ startImmediately: true }));
        yield* Effect.promise(() => native.started.promise);
        native.approval.resolve();
        yield* Fiber.interrupt(pending);
        yield* Effect.promise(() => native.settled.promise);
        expect(getConnection(config).status).toBe("disconnected");
        expect(config.state.connections.size).toBe(0);
      })
  );

  it.effect(
    "does not let abandoned rejection clear a newer pending connection or the prior account",
    () =>
      Effect.gen(function* () {
        const abandoned = pendingConnector("abandoned", firstAddress);
        const replacement = pendingConnector("replacement", changedAddress);
        const config = makeConfig(
          mock({ accounts: [secondAddress] }),
          abandoned.connector,
          replacement.connector
        );
        yield* wagmiOperations.connect(config, {
          connector: config.connectors[0]!,
        });
        const first = yield* wagmiOperations
          .connect(config, { connector: config.connectors[1]! })
          .pipe(Effect.forkChild({ startImmediately: true }));
        yield* Effect.promise(() => abandoned.started.promise);
        yield* Fiber.interrupt(first);
        expect(getConnection(config)).toMatchObject({
          address: secondAddress,
          status: "connected",
        });
        const next = yield* wagmiOperations
          .connect(config, { connector: config.connectors[2]! })
          .pipe(Effect.forkChild({ startImmediately: true }));
        yield* Effect.promise(() => replacement.started.promise);
        abandoned.approval.reject(new Error("Late wallet rejection"));
        yield* Effect.promise(() => abandoned.settled.promise);
        expect(config.state.status).toBe("connecting");
        expect(config.state.current).toBe(config.connectors[0]!.uid);
        replacement.approval.reject(new Error("Current wallet rejection"));
        yield* Fiber.await(next);
        expect(getConnection(config)).toMatchObject({
          address: secondAddress,
          status: "connected",
        });
      })
  );

  it.effect(
    "guards unsolicited approvals from connectors discovered after runtime construction",
    () =>
      Effect.gen(function* () {
        const config = makeConfig(mock({ accounts: [secondAddress] }));
        const dispose = ownWagmiConnections(config);
        try {
          yield* wagmiOperations.connect(config, {
            connector: config.connectors[0]!,
          });
          const discovered = config._internal.connectors.setup(
            mock({ accounts: [firstAddress] })
          );
          config._internal.connectors.setState((connectors) => [
            ...connectors,
            discovered,
          ]);
          discovered.emitter.emit("connect", {
            accounts: [firstAddress],
            chainId: 1,
          });
          expect(getConnection(config)).toMatchObject({
            address: secondAddress,
            status: "connected",
          });
        } finally {
          dispose();
        }
      })
  );

  it.effect("stops publishing provider changes after runtime disposal", () =>
    Effect.gen(function* () {
      const config = makeConfig(mock({ accounts: [firstAddress] }));
      const dispose = ownWagmiConnections(config);
      const connector = config.connectors[0]!;
      yield* wagmiOperations.connect(config, { connector });
      dispose();
      connector.emitter.emit("change", { accounts: [changedAddress] });
      connector.emitter.emit("disconnect");
      expect(getConnection(config)).toMatchObject({
        address: firstAddress,
        status: "connected",
      });
    })
  );
});
