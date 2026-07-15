import { Effect, Schema } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { Chain } from "viem";
import type { AdditionalAddresses } from "../../../domain/schema/address-models";
import { WalletAddress } from "../../../domain/schema/identifiers";
import type { CosmosChainsMap } from "../../../domain/types/chains/cosmos";
import type { EvmChainsMap } from "../../../domain/types/chains/evm";
import type { MiscChainsMap } from "../../../domain/types/chains/misc";
import type { SubstrateChainsMap } from "../../../domain/types/chains/substrate";
import { isLedgerLiveConnector } from "../../../services/wallet/connectors/ledger/ledger-live-connector-meta";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../services/wallet/domain/state";
import { forcedWalletAddress } from "../../../services/wallet/environment";
import { wagmiNetworkToSKNetwork } from "../../../services/wallet/network";
import type { WalletConnectionSnapshot } from "./connection";
import type { LedgerConnectorState } from "./ledger";

export {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../services/wallet/domain/state";

export type WalletStateController = {
  readonly cosmosConfig: { readonly cosmosChainsMap: Partial<CosmosChainsMap> };
  readonly evmConfig: { readonly evmChainsMap: Partial<EvmChainsMap> };
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
  readonly additionalAddresses: AdditionalAddresses | null;
  readonly connection: WalletConnectionSnapshot;
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

export const makeWalletStateAtom = <
  ControllerError,
  ConnectionError,
  ConnectorChainsError,
  LedgerStateError,
  AdditionalAddressesError,
>(
  controllerAtom: Atom.Atom<
    AsyncResult.AsyncResult<WalletStateController, ControllerError>
  >,
  connectionAtom: Atom.Atom<
    AsyncResult.AsyncResult<WalletConnectionSnapshot, ConnectionError>
  >,
  connectorChainsAtom: Atom.Atom<
    AsyncResult.AsyncResult<Chain[], ConnectorChainsError>
  >,
  ledgerStateAtom: Atom.Atom<
    AsyncResult.AsyncResult<LedgerConnectorState, LedgerStateError>
  >,
  additionalAddressesAtom: Atom.Atom<
    AsyncResult.AsyncResult<
      AdditionalAddresses | null,
      AdditionalAddressesError
    >
  >
): Atom.Atom<
  AsyncResult.AsyncResult<
    NormalizedWalletState,
    | ControllerError
    | ConnectionError
    | ConnectorChainsError
    | LedgerStateError
    | AdditionalAddressesError
  >
> =>
  Atom.make(
    (get) =>
      Effect.all([
        get.result(controllerAtom),
        get.result(connectionAtom),
        get.result(connectorChainsAtom),
        get.result(ledgerStateAtom),
        get.result(additionalAddressesAtom),
      ]).pipe(
        Effect.map(
          ([
            controller,
            connection,
            connectorChains,
            ledgerState,
            additionalAddresses,
          ]) =>
            normalizeWalletState({
              additionalAddresses,
              connection,
              connectorChains,
              controller,
              forceAddress: forcedWalletAddress,
              ledgerState,
            })
        )
      ),
    { initialValue: disconnectedNormalizedWalletState }
  ).pipe(Atom.setIdleTTL(0));
