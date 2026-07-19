import { Effect, Equal, Ref, type Scope, Stream } from "effect";
import {
  normalizeWidgetBootstrapConfig,
  WidgetConfigService,
} from "../config/widget-config";
import {
  makeExternalProviderSnapshot,
  type WalletBootstrapResult,
} from "./bootstrap";
import { isExternalProviderConnector } from "./connectors/external-provider";
import { WalletRuntimeInvariantError } from "./domain/errors";
import type { WalletStateContext, WalletStateRuntime } from "./wallet-state";

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

  const failInvariant = Effect.fn("failInvariant")(function* (
    reason: WalletRuntimeInvariantError["reason"]
  ) {
    const error = new WalletRuntimeInvariantError({ reason });
    yield* Effect.logError("Wallet Runtime invariant violated").pipe(
      Effect.annotateLogs({
        event: "wallet_runtime_invariant_violated",
        reason,
      })
    );
    yield* state.failInvariant(error);
  });

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

  const settings = Stream.concat(
    Stream.succeed(yield* config.current),
    config.changes
  ).pipe(
    Stream.mapEffect((next) => {
      const nextTopology = normalizeWidgetBootstrapConfig({
        isLedgerLive: next.isLedgerLive,
        settings: next,
      }).wallet;
      if (!Equal.equals(nextTopology, bootstrap.snapshot.config.wallet)) {
        return failInvariant("wallet-topology-changed").pipe(
          Effect.as(makeExternalProviderSnapshot(next))
        );
      }
      const snapshot = makeExternalProviderSnapshot(next);
      if ((snapshot !== undefined) !== bootstrap.externalProviderMode) {
        return failInvariant("external-provider-presence-changed").pipe(
          Effect.as(snapshot)
        );
      }
      if (snapshot && bootstrap.externalProviders) {
        bootstrap.externalProviders.current = snapshot;
      }
      return Effect.succeed(snapshot);
    })
  );

  yield* Stream.zipLatestAll(state.contexts, settings).pipe(
    Stream.runForEach(([context]) => synchronize(context)),
    Effect.forkScoped({ startImmediately: true })
  );
});
