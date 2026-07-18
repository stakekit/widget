import type { ChainWalletBase } from "@cosmos-kit/core";
import { Effect, Schema, Stream } from "effect";
import type { Chain } from "viem";
import type { Connector } from "wagmi";
import { AdditionalAddresses } from "../../domain/schema/address-models";
import {
  WalletAddress,
  type WalletAddress as WalletAddressType,
} from "../../domain/schema/identifiers";
import type { CosmosChainsMap } from "../../domain/types/chains/cosmos";
import type { EvmChainsMap } from "../../domain/types/chains/evm";
import type { MiscChainsMap } from "../../domain/types/chains/misc";
import type { SubstrateChainsMap } from "../../domain/types/chains/substrate";
import { isConnectorWithFilteredChains } from "../../domain/types/connectors";
import type { StoredPublicKeys } from "../persistence/widget-persistence";
import {
  type CosmosConnector,
  isCosmosConnector,
} from "./connectors/cosmos/cosmos-connector-meta";
import { isLedgerLiveConnector } from "./connectors/ledger/ledger-live-connector-meta";
import type { WalletCoreProjection, WalletProjection } from "./domain/runtime";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type LedgerConnectorState,
  type NormalizedWalletState,
} from "./domain/state";
import { forcedWalletAddress } from "./environment";
import { wagmiNetworkToSKNetwork } from "./network";
import type { WalletRoutingContext } from "./router";
import type { WalletController } from "./wagmi-config";

export type WalletStateController = {
  readonly cosmosConfig: { readonly cosmosChainsMap: Partial<CosmosChainsMap> };
  readonly evmConfig: {
    readonly evmChainsMap: Partial<EvmChainsMap>;
  };
  readonly isLedgerLive: boolean;
  readonly miscConfig: { readonly miscChainsMap: Partial<MiscChainsMap> };
  readonly substrateConfig: {
    readonly substrateChainsMap: Partial<SubstrateChainsMap>;
  };
};

export const normalizeWalletState = ({
  additionalAddresses,
  connection,
  connectorChains,
  controller,
  forceAddress,
  ledgerState,
}: {
  readonly additionalAddresses: typeof AdditionalAddresses.Type | null;
  readonly connection: WalletCoreProjection["connection"];
  readonly connectorChains: Chain[];
  readonly controller: WalletStateController;
  readonly forceAddress: string | undefined;
  readonly ledgerState: LedgerConnectorState;
}): NormalizedWalletState => {
  const isLedgerLive =
    controller.isLedgerLive ||
    !!(connection.connector && isLedgerLiveConnector(connection.connector));
  const common = { connectorChains, isLedgerLive };

  if (
    connection.status === "connecting" ||
    connection.status === "reconnecting"
  ) {
    return {
      ...disconnectedNormalizedWalletState,
      ...common,
      status: "connecting",
    };
  }

  if (connection.status !== "connected") {
    return { ...disconnectedNormalizedWalletState, ...common };
  }

  const rawAddress = forceAddress || connection.address || null;
  const address = rawAddress
    ? Schema.decodeSync(WalletAddress)(rawAddress)
    : null;
  const chain = connection.chain ?? null;
  const connector = connection.connector ?? null;
  const network = chain
    ? wagmiNetworkToSKNetwork({
        chain,
        cosmosChainsMap: controller.cosmosConfig.cosmosChainsMap,
        evmChainsMap: controller.evmConfig.evmChainsMap,
        miscChainsMap: controller.miscConfig.miscChainsMap,
        substrateChainsMap: controller.substrateConfig.substrateChainsMap,
      })
    : null;

  if (!network) {
    return {
      ...common,
      additionalAddresses: null,
      address,
      chain,
      connector,
      isLedgerLiveAccountPlaceholder: false,
      ledgerAccounts: null,
      network: null,
      status: "unsupported",
    };
  }

  if (!address || !chain || !connector) {
    return {
      ...disconnectedNormalizedWalletState,
      ...common,
      status: "connecting",
    };
  }

  return {
    ...common,
    additionalAddresses,
    address,
    chain,
    connector,
    isLedgerLiveAccountPlaceholder:
      isLedgerLiveConnector(connector) &&
      address === connector.noAccountPlaceholder,
    ledgerAccounts: ledgerState.accounts,
    network,
    status: "connected",
  };
};

const makeConnectorChainsStream = ({
  connector,
  defaultEvmChains,
}: {
  readonly connector: Connector | undefined;
  readonly defaultEvmChains: Chain[];
}) => {
  if (!connector || !isConnectorWithFilteredChains(connector)) {
    return Stream.succeed(defaultEvmChains);
  }

  return connector.$filteredChains.pipe(Stream.changes);
};

const makeLedgerConnectorStateStream = (
  connector: WalletCoreProjection["connection"]["connector"]
) => {
  if (!connector || !isLedgerLiveConnector(connector)) {
    return Stream.succeed(disconnectedLedgerConnectorState);
  }

  return Stream.zipLatestAll(
    connector.$accountsOnCurrentChain,
    connector.$currentAccountId,
    connector.$disabledChains
  ).pipe(
    Stream.map(
      ([accounts, currentAccountId, disabledChains]) =>
        ({
          accounts,
          currentAccountId,
          disabledChains,
        }) satisfies LedgerConnectorState
    ),
    Stream.changes
  );
};

const makeCosmosChainWalletStream = (
  connector: WalletCoreProjection["connection"]["connector"]
) => {
  if (!connector || !isCosmosConnector(connector)) {
    return Stream.succeed<ChainWalletBase | null>(null);
  }

  return connector.$chainWallet.pipe(Stream.changes);
};

const getCosmosAdditionalAddresses = ({
  address,
  chainWallet,
  connector,
  readStoredPublicKeys,
}: {
  readonly address: WalletAddressType;
  readonly chainWallet: ChainWalletBase;
  readonly connector: CosmosConnector;
  readonly readStoredPublicKeys: Effect.Effect<StoredPublicKeys, unknown>;
}) =>
  Effect.gen(function* () {
    const storedPublicKeys = yield* readStoredPublicKeys;
    const storedPublicKey = storedPublicKeys[address];
    const cosmosPubKey = storedPublicKey
      ? storedPublicKey
      : yield* Effect.tryPromise({
          try: () =>
            chainWallet.client.getAccount!(chainWallet.chainId).then(
              (account) => connector.toBase64(account.pubkey)
            ),
          catch: (cause) => cause,
        });

    return yield* Schema.decodeEffect(AdditionalAddresses)({ cosmosPubKey });
  });

const makeAdditionalAddresses = ({
  chainWallet,
  connection,
  readStoredPublicKeys,
}: {
  readonly chainWallet: ChainWalletBase | null;
  readonly connection: WalletCoreProjection["connection"];
  readonly readStoredPublicKeys: Effect.Effect<StoredPublicKeys, unknown>;
}) => {
  const connector = connection.connector;
  if (
    !connection.isConnected ||
    !connection.address ||
    !chainWallet ||
    !connector ||
    !isCosmosConnector(connector)
  ) {
    return Effect.succeed(null);
  }

  return getCosmosAdditionalAddresses({
    address: Schema.decodeSync(WalletAddress)(connection.address),
    chainWallet,
    connector,
    readStoredPublicKeys,
  }).pipe(Effect.catch(() => Effect.succeed(null)));
};

type CompleteWalletState = {
  readonly projection: WalletProjection;
  readonly routing: WalletRoutingContext;
};

export const makeCompleteWalletStateStream = ({
  controller,
  projection,
  readStoredPublicKeys,
}: {
  readonly controller: WalletController;
  readonly projection: WalletCoreProjection;
  readonly readStoredPublicKeys: Effect.Effect<StoredPublicKeys, unknown>;
}): Stream.Stream<CompleteWalletState> => {
  const connector = projection.connection.connector;
  const connectorChains = makeConnectorChainsStream({
    connector,
    defaultEvmChains: controller.evmConfig.evmChains,
  }).pipe(
    Stream.catchCause(() => Stream.succeed(controller.evmConfig.evmChains))
  );
  const ledgerState = makeLedgerConnectorStateStream(connector).pipe(
    Stream.catchCause(() => Stream.succeed(disconnectedLedgerConnectorState))
  );
  const cosmosChainWallet = makeCosmosChainWalletStream(connector).pipe(
    Stream.catchCause(() => Stream.succeed(null))
  );

  return Stream.zipLatestAll(
    connectorChains,
    ledgerState,
    cosmosChainWallet
  ).pipe(
    Stream.switchMap(([chains, ledger, chainWallet]) =>
      Stream.fromEffect(
        makeAdditionalAddresses({
          chainWallet,
          connection: projection.connection,
          readStoredPublicKeys,
        }).pipe(
          Effect.map((additionalAddresses) => {
            const state = normalizeWalletState({
              additionalAddresses,
              connection: projection.connection,
              connectorChains: chains,
              controller,
              forceAddress: forcedWalletAddress,
              ledgerState: ledger,
            });

            return {
              projection: {
                ...projection,
                ledgerState: ledger,
                state,
              },
              routing: {
                actions: controller.actions,
                cosmosChainWallet: chainWallet,
                ledgerState: ledger,
                state,
              },
            } satisfies CompleteWalletState;
          })
        )
      )
    ),
    Stream.changes
  );
};
