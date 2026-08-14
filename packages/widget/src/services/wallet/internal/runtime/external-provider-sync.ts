import { Effect, Ref, type Scope, Stream } from "effect";
import {
  diffWidgetWalletConfig,
  selectWidgetBootstrapSnapshot,
  WidgetConfigService,
} from "../../../config/widget-config";
import { WalletRuntimeInvariantError } from "../../wallet-errors";
import { isExternalProviderConnector } from "../adapters/external-provider";
import type { WalletBootstrapResult } from "./bootstrap";
import type { WalletStateContext, WalletStateRuntime } from "./state";

type SynchronizationMemory = {
  readonly accountNotification: string | null;
  readonly chainNotification: string | null;
  readonly connecting: {
    readonly address: string;
    readonly key: string;
  } | null;
  readonly supportedChainsNotification: string | null;
};

const initialMemory: SynchronizationMemory = {
  accountNotification: null,
  chainNotification: null,
  connecting: null,
  supportedChainsNotification: null,
};

const runConnectorNotification = Effect.fn("runConnectorNotification")(
  function* (notify: () => void) {
    yield* Effect.try({
      try: notify,
      catch: (cause) => cause,
    }).pipe(
      Effect.catch((cause) =>
        Effect.logWarning("External provider notification failed").pipe(
          Effect.annotateLogs({ cause })
        )
      )
    );
  }
);

export const installExternalProviderSynchronization = Effect.fn(
  "installExternalProviderSynchronization"
)(function* ({
  bootstrap,
  state,
}: {
  readonly bootstrap: WalletBootstrapResult;
  readonly state: WalletStateRuntime;
}): Effect.fn.Return<void, never, Scope.Scope | WidgetConfigService> {
  const config = yield* WidgetConfigService;
  const memory = yield* Ref.make(initialMemory);
  const reportedUnstableKeys = yield* Ref.make<ReadonlyArray<string>>([]);

  const failInvariant = Effect.fn("failInvariant")(function* (
    reason: WalletRuntimeInvariantError["reason"],
    annotations: Record<string, unknown> = {}
  ) {
    const error = new WalletRuntimeInvariantError({ reason });
    yield* Effect.logError("Wallet Runtime invariant violated").pipe(
      Effect.annotateLogs({
        event: "wallet_runtime_invariant_violated",
        reason,
        ...annotations,
      })
    );
    yield* state.failInvariant(error);
  });

  const reportUnstableWalletProps = Effect.fn("reportUnstableWalletProps")(
    function* (keys: ReadonlyArray<string>) {
      const reported = yield* Ref.get(reportedUnstableKeys);
      const fresh = keys.filter((key) => !reported.includes(key));
      if (fresh.length === 0) return;

      yield* Ref.update(reportedUnstableKeys, (current) => [
        ...current,
        ...fresh,
      ]);
      yield* Effect.logWarning(
        "Wallet configuration functions changed identity after bootstrap and were ignored"
      ).pipe(
        Effect.annotateLogs({
          event: "wallet_config_function_unstable",
          keys: fresh,
        })
      );
    }
  );

  const synchronize = Effect.fn("synchronize")(function* (
    context: WalletStateContext
  ) {
    if (!bootstrap.externalProviderMode || !bootstrap.externalProviders) {
      return;
    }

    const matchingConnectors = context.core.connectors.filter(
      isExternalProviderConnector
    );
    if (matchingConnectors.length === 0) {
      return yield* failInvariant("external-provider-connector-missing");
    }
    if (matchingConnectors.length !== 1) {
      return yield* failInvariant("external-provider-connector-mismatch");
    }
    const connector = matchingConnectors[0];
    if (!connector) {
      return yield* failInvariant("external-provider-connector-missing");
    }
    const connection = context.core.connection;
    if (
      connection.connector &&
      !isExternalProviderConnector(connection.connector)
    ) {
      return yield* failInvariant("external-provider-connector-mismatch");
    }

    const snapshot = bootstrap.externalProviders.current;
    const currentChainId =
      snapshot.currentChain ??
      connection.chainId ??
      bootstrap.controller.wagmiConfig.state.chainId;
    const supportedChainIds = snapshot.supportedChainIds
      ? [...snapshot.supportedChainIds]
      : [];
    const currentMemory = yield* Ref.get(memory);
    const supportedChainsKey = `${connector.uid}:${currentChainId}:${
      supportedChainIds.join(",") || "all"
    }`;
    if (currentMemory.supportedChainsNotification !== supportedChainsKey) {
      yield* Ref.update(memory, (current) => ({
        ...current,
        supportedChainsNotification: supportedChainsKey,
      }));
      yield* runConnectorNotification(() =>
        connector.onSupportedChainsChanged({
          currentChainId,
          supportedChainIds,
        })
      );
    }

    if (
      connection.status === "disconnected" &&
      snapshot.currentAddress &&
      currentMemory.connecting === null
    ) {
      const address = snapshot.currentAddress;
      const key = `${connector.uid}:${address}`;
      yield* Ref.update(memory, (current) => ({
        ...current,
        connecting: { address, key },
      }));
      yield* bootstrap.controller.actions.connect({ connector }).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("External provider connection failed").pipe(
            Effect.annotateLogs({ cause })
          )
        ),
        Effect.ensuring(
          Ref.update(memory, (current) =>
            current.connecting?.key === key
              ? { ...current, connecting: null }
              : current
          )
        ),
        Effect.forkScoped({ startImmediately: true })
      );
      return;
    }

    if (
      connection.status !== "connected" ||
      connection.connector?.uid !== connector.uid
    ) {
      return;
    }

    if (currentMemory.connecting) {
      yield* Ref.update(memory, (current) => ({
        ...current,
        connecting: null,
      }));
    }
    const accountKey = `${connector.uid}:${connection.address ?? ""}:${snapshot.currentAddress}`;
    if (connection.address === snapshot.currentAddress) {
      yield* Ref.update(memory, (current) => ({
        ...current,
        accountNotification: null,
      }));
    } else if (currentMemory.accountNotification !== accountKey) {
      yield* Ref.update(memory, (current) => ({
        ...current,
        accountNotification: accountKey,
      }));
      yield* runConnectorNotification(() =>
        connector.onAccountsChanged([snapshot.currentAddress])
      );
    }

    const chainKey = `${connector.uid}:${connection.chainId ?? ""}:${
      snapshot.currentChain ?? ""
    }`;
    if (
      snapshot.currentChain === undefined ||
      connection.chainId === snapshot.currentChain
    ) {
      yield* Ref.update(memory, (current) => ({
        ...current,
        chainNotification: null,
      }));
    } else if (currentMemory.chainNotification !== chainKey) {
      yield* Ref.update(memory, (current) => ({
        ...current,
        chainNotification: chainKey,
      }));
      yield* runConnectorNotification(() =>
        connector.onChainChanged(snapshot.currentChain!.toString())
      );
    }
  });

  const settings = config.values.pipe(
    Stream.mapEffect((next) =>
      Effect.gen(function* () {
        const difference = diffWidgetWalletConfig(
          selectWidgetBootstrapSnapshot(next).wallet,
          bootstrap.snapshot.config.wallet
        );
        const snapshot = next.externalProviders;

        if (difference.material.length > 0) {
          yield* failInvariant("wallet-topology-changed", {
            changedKeys: difference.material,
          });
          return snapshot;
        }

        if (difference.opaque.length > 0) {
          yield* reportUnstableWalletProps(difference.opaque);
        }

        if ((snapshot !== undefined) !== bootstrap.externalProviderMode) {
          yield* failInvariant("external-provider-presence-changed");
          return snapshot;
        }

        if (snapshot && bootstrap.externalProviders) {
          bootstrap.externalProviders.current = snapshot;
        }

        return snapshot;
      })
    )
  );

  yield* Stream.zipLatestAll(state.contexts, settings).pipe(
    Stream.runForEach(([context]) => synchronize(context)),
    Effect.forkScoped({ startImmediately: true })
  );
});
