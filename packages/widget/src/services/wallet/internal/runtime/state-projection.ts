import type { ChainWalletBase } from "@cosmos-kit/core";
import { Effect, Schema, Stream } from "effect";
import type { Chain } from "viem";
import type { Connector } from "wagmi";
import {
  WalletAddress,
  type WalletAddress as WalletAddressType,
} from "../../../../domain/identity/identifiers";
import { AdditionalAddresses } from "../../../../domain/wallet/address";
import type { WalletNetwork } from "../../../../domain/wallet/network";
import { sameWalletScopeOwner } from "../../../../domain/wallet/wallet-scope";
import { config } from "../../../../shared/config/widget-defaults";
import type { StoredPublicKeys } from "../../../persistence/widget-persistence";
import { isConnectorWithFilteredChains } from "../../wallet-connectors";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type LedgerConnectorState,
  type NormalizedWalletState,
  type WalletCoreState,
  type WalletState,
} from "../../wallet-state";
import type { MiscChainsMap } from "../adapters/configured-chains";
import type { CosmosChainsMap } from "../adapters/cosmos/chains";
import {
  type CosmosConnector,
  isCosmosConnector,
} from "../adapters/cosmos/cosmos-connector-meta";
import type { EvmChainsMap } from "../adapters/evm/chains";
import { isLedgerLiveConnector } from "../adapters/ledger/ledger-live-connector-meta";
import type { SubstrateChainsMap } from "../adapters/substrate/chains";
import type { WalletRoutingContext } from "./router";
import type { WalletController } from "./wagmi-config";

const wagmiNetworkToSKNetwork = ({
  chain,
  cosmosChainsMap,
  evmChainsMap,
  miscChainsMap,
  substrateChainsMap,
}: {
  chain: Chain;
  evmChainsMap: Partial<EvmChainsMap>;
  cosmosChainsMap: Partial<CosmosChainsMap>;
  miscChainsMap: Partial<MiscChainsMap>;
  substrateChainsMap: Partial<SubstrateChainsMap>;
}): WalletNetwork | null => {
  return (
    Object.values({
      ...evmChainsMap,
      ...cosmosChainsMap,
      ...miscChainsMap,
      ...substrateChainsMap,
    }).find((c) => c.wagmiChain.id === chain.id)?.network ?? null
  );
};

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

type WalletProjectionInput = {
  readonly additionalAddresses: typeof AdditionalAddresses.Type | null;
  readonly connection: WalletCoreState["connection"];
  readonly connectorChains: Chain[];
  readonly controller: WalletStateController;
  readonly forceAddress: string | undefined;
  readonly ledgerState: LedgerConnectorState;
  readonly previous?: NormalizedWalletState;
};

const decodeProjectionFacts = ({
  additionalAddresses,
  connection,
  connectorChains,
  controller,
  forceAddress,
  ledgerState,
  previous,
}: WalletProjectionInput) => {
  const isLedgerLive =
    controller.isLedgerLive ||
    !!(connection.connector && isLedgerLiveConnector(connection.connector));
  const common = { connectorChains, isLedgerLive };
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

  return {
    additionalAddresses,
    address,
    chain,
    common,
    connector,
    ledgerState,
    network,
    previous,
  };
};

const connectingWalletState = (
  facts: ReturnType<typeof decodeProjectionFacts>
): NormalizedWalletState => {
  const {
    additionalAddresses,
    address,
    chain,
    common,
    connector,
    ledgerState,
    network,
    previous,
  } = facts;

  if (chain && !network) {
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

  const connectingConnector = connector ?? previous?.connector ?? null;
  if (address && chain && connectingConnector && network) {
    const samePreviousOwner =
      previous?.address &&
      previous.network &&
      sameWalletScopeOwner(previous, {
        address,
        network,
      });
    const samePreviousConnector =
      samePreviousOwner && previous.connector?.uid === connectingConnector.uid;

    return {
      ...common,
      additionalAddresses: samePreviousOwner
        ? previous.additionalAddresses
        : additionalAddresses,
      address,
      chain,
      connector: connectingConnector,
      isLedgerLiveAccountPlaceholder:
        isLedgerLiveConnector(connectingConnector) &&
        address === connectingConnector.noAccountPlaceholder,
      ledgerAccounts: samePreviousConnector
        ? (previous.ledgerAccounts ?? ledgerState.accounts)
        : ledgerState.accounts,
      network,
      status: "connecting",
    };
  }

  if (
    previous?.address &&
    previous.network &&
    previous.chain &&
    previous.connector &&
    previous.ledgerAccounts
  ) {
    return {
      ...previous,
      ...common,
      status: "connecting",
    };
  }

  return {
    ...disconnectedNormalizedWalletState,
    ...common,
    status: "connecting",
  };
};

export const normalizeWalletState = (
  input: WalletProjectionInput
): NormalizedWalletState => {
  const { connection } = input;
  const isLedgerLive =
    input.controller.isLedgerLive ||
    !!(connection.connector && isLedgerLiveConnector(connection.connector));
  const common = { connectorChains: input.connectorChains, isLedgerLive };

  if (
    connection.status !== "connected" &&
    connection.status !== "connecting" &&
    connection.status !== "reconnecting"
  ) {
    return { ...disconnectedNormalizedWalletState, ...common };
  }

  const facts = decodeProjectionFacts(input);

  if (
    connection.status === "connecting" ||
    connection.status === "reconnecting"
  ) {
    return connectingWalletState(facts);
  }

  const {
    additionalAddresses,
    address,
    chain,
    connector,
    ledgerState,
    network,
  } = facts;

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

export const transitionalWalletState = (
  input: WalletProjectionInput
): NormalizedWalletState => {
  if (input.connection.status === "disconnected") {
    return normalizeWalletState(input);
  }

  return connectingWalletState(decodeProjectionFacts(input));
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
  connector: WalletCoreState["connection"]["connector"]
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
  connector: WalletCoreState["connection"]["connector"]
) => {
  if (!connector || !isCosmosConnector(connector)) {
    return Stream.succeed<ChainWalletBase | null>(null);
  }

  return connector.$chainWallet.pipe(Stream.changes);
};

const getCosmosAdditionalAddresses = Effect.fn("getCosmosAdditionalAddresses")(
  function* ({
    address,
    chainWallet,
    connector,
    readStoredPublicKeys,
  }: {
    readonly address: WalletAddressType;
    readonly chainWallet: ChainWalletBase;
    readonly connector: CosmosConnector;
    readonly readStoredPublicKeys: Effect.Effect<StoredPublicKeys, unknown>;
  }) {
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
  }
);

const makeAdditionalAddresses = Effect.fn("makeAdditionalAddresses")(
  function* ({
    chainWallet,
    connection,
    readStoredPublicKeys,
  }: {
    readonly chainWallet: ChainWalletBase | null;
    readonly connection: WalletCoreState["connection"];
    readonly readStoredPublicKeys: Effect.Effect<StoredPublicKeys, unknown>;
  }) {
    const connector = connection.connector;
    if (
      !connection.isConnected ||
      !connection.address ||
      !chainWallet ||
      !connector ||
      !isCosmosConnector(connector)
    ) {
      return null;
    }

    return yield* getCosmosAdditionalAddresses({
      address: Schema.decodeSync(WalletAddress)(connection.address),
      chainWallet,
      connector,
      readStoredPublicKeys,
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("Wallet state enrichment degraded").pipe(
          Effect.annotateLogs({ cause, slice: "cosmos-additional-addresses" }),
          Effect.as(null)
        )
      )
    );
  }
);

type CompleteWalletState = {
  readonly routing: WalletRoutingContext;
  readonly state: WalletState;
};

const recoverWalletStateSlice = <A>(slice: string, fallback: A) =>
  Stream.catchCause((cause) =>
    Stream.fromEffect(
      Effect.logWarning("Wallet state enrichment degraded").pipe(
        Effect.annotateLogs({ cause, slice }),
        Effect.as(fallback)
      )
    )
  );

export const makeCompleteWalletStateStream = ({
  controller,
  previous,
  projection,
  readStoredPublicKeys,
}: {
  readonly controller: WalletController;
  readonly previous?: NormalizedWalletState;
  readonly projection: WalletCoreState;
  readonly readStoredPublicKeys: Effect.Effect<StoredPublicKeys, unknown>;
}): Stream.Stream<CompleteWalletState> => {
  const connector = projection.connection.connector;
  const connectorChains = makeConnectorChainsStream({
    connector,
    defaultEvmChains: controller.evmConfig.evmChains,
  }).pipe(
    recoverWalletStateSlice("connector-chains", controller.evmConfig.evmChains)
  );
  const ledgerState = makeLedgerConnectorStateStream(connector).pipe(
    recoverWalletStateSlice("ledger-state", disconnectedLedgerConnectorState)
  );
  const cosmosChainWallet = makeCosmosChainWalletStream(connector).pipe(
    recoverWalletStateSlice("cosmos-chain-wallet", null)
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
              forceAddress: config.env.forceAddress,
              ledgerState: ledger,
              previous,
            });

            return {
              routing: {
                actions: controller.actions,
                cosmosChainWallet: chainWallet,
                ledgerState: ledger,
                state,
              },
              state: {
                connection: state,
                ledger,
              },
            } satisfies CompleteWalletState;
          })
        )
      )
    ),
    Stream.changes
  );
};
