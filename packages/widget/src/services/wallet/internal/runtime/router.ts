import { Effect } from "effect";
import type { Connector } from "wagmi";
import { isEvmWalletNetwork } from "../../../../domain/wallet/network";
import type {
  WalletSignBorrowTypedDataInput,
  WalletSignMessageInput,
  WalletSignPermitInput,
  WalletSwitchAccountInput,
} from "../../wallet-commands";
import type { Chain } from "../../wallet-descriptors";
import {
  WalletCapabilityUnavailableError,
  WalletDecodeError,
} from "../../wallet-errors";
import type {
  LedgerConnectorState,
  NormalizedWalletState,
} from "../../wallet-state";
import type { WalletSignTransactionInput } from "../../wallet-transactions";
import { isCardanoConnector } from "../adapters/cardano/cardano-connector-meta";
import { makeCardanoWalletDriver } from "../adapters/cardano/driver";
import {
  type CosmosChainWallet,
  isCosmosConnector,
} from "../adapters/cosmos/cosmos-connector-meta";
import { makeCosmosWalletDriver } from "../adapters/cosmos/driver";
import { makeEvmWalletDriver } from "../adapters/evm/driver";
import { isEvmAddress } from "../adapters/evm/transaction";
import { isExternalProviderConnector } from "../adapters/external-provider";
import { makeExternalProviderWalletDriver } from "../adapters/external-provider/driver";
import { makeLedgerWalletDriver } from "../adapters/ledger/driver";
import { isLedgerLiveConnector } from "../adapters/ledger/ledger-live-connector-meta";
import { makeSafeWalletDriver } from "../adapters/safe/driver";
import { isSafeConnector } from "../adapters/safe/safe-connector-meta";
import { makeSolanaWalletDriver } from "../adapters/solana/driver";
import { isSolanaConnector } from "../adapters/solana/solana-connector-meta";
import { makeStellarWalletDriver } from "../adapters/stellar/driver";
import { isStellarConnector } from "../adapters/stellar/stellar-connector-meta";
import { makeSubstrateWalletDriver } from "../adapters/substrate/driver";
import { isSubstrateConnector } from "../adapters/substrate/substrate-connector-meta";
import { makeTonWalletDriver } from "../adapters/ton/driver";
import { isTonConnector } from "../adapters/ton/ton-connector-meta";
import { makeTronWalletDriver } from "../adapters/tron/driver";
import { isTronConnector } from "../adapters/tron/tron-connector-meta";
import type { WagmiActions } from "./wagmi-actions";

export type WalletRoutingContext = {
  readonly actions: WagmiActions;
  readonly cosmosChainWallet: CosmosChainWallet | null;
  readonly ledgerState: LedgerConnectorState;
  readonly state: NormalizedWalletState;
};

const unavailable = (
  capability: "account" | "message" | "transaction" | "typed-data",
  state: NormalizedWalletState
) =>
  new WalletCapabilityUnavailableError({
    capability,
    connectorId: state.connector?.id ?? null,
  });

const canUseWagmiSigning = (connector: Connector) =>
  !isLedgerLiveConnector(connector) &&
  !isStellarConnector(connector) &&
  !isSubstrateConnector(connector) &&
  !isCosmosConnector(connector) &&
  !isTronConnector(connector) &&
  !isSolanaConnector(connector) &&
  !isCardanoConnector(connector) &&
  !isTonConnector(connector);

/** Who signs a message or typed data for the connected wallet. */
type EvmSigningAdmission = {
  readonly connector: Connector;
  readonly signer: "external-provider" | "wagmi";
};

const admitEvmSigning = (
  state: NormalizedWalletState,
  capability: "message" | "typed-data"
): Effect.Effect<EvmSigningAdmission, WalletCapabilityUnavailableError> => {
  if (state.status !== "connected") {
    return Effect.fail(unavailable(capability, state));
  }
  if (isExternalProviderConnector(state.connector)) {
    return Effect.succeed({
      connector: state.connector,
      signer: "external-provider",
    });
  }
  if (
    !isEvmWalletNetwork(state.network) ||
    !canUseWagmiSigning(state.connector)
  ) {
    return Effect.fail(unavailable(capability, state));
  }
  return Effect.succeed({ connector: state.connector, signer: "wagmi" });
};

export const routeWalletMessage = Effect.fn("routeWalletMessage")(function* (
  { actions, state }: WalletRoutingContext,
  input: WalletSignMessageInput
) {
  const { connector, signer } = yield* admitEvmSigning(state, "message");
  if (signer === "external-provider") {
    return yield* makeExternalProviderWalletDriver({
      connector,
    }).signMessage(input);
  }

  return yield* actions.signMessage({ ...input, connector });
});

export const routeWalletTypedData = Effect.fn("routeWalletTypedData")(
  function* (
    { actions, state }: WalletRoutingContext,
    input: WalletSignBorrowTypedDataInput
  ) {
    const { connector, signer } = yield* admitEvmSigning(state, "typed-data");
    if (signer === "external-provider") {
      return yield* makeExternalProviderWalletDriver({
        connector,
      }).signTypedData(input);
    }

    return yield* actions.signTypedData({ ...input.typedData, connector });
  }
);

export const canRouteWalletPermit = ({ state }: WalletRoutingContext) =>
  state.status === "connected" &&
  (isExternalProviderConnector(state.connector)
    ? state.connector.canSignZamaPermit()
    : isEvmWalletNetwork(state.network) && canUseWagmiSigning(state.connector));

export const routeWalletPermit = Effect.fn("routeWalletPermit")(function* (
  { actions, state }: WalletRoutingContext,
  input: WalletSignPermitInput
) {
  const { connector, signer } = yield* admitEvmSigning(state, "typed-data");
  if (signer === "external-provider") {
    return yield* makeExternalProviderWalletDriver({
      connector,
    }).signZamaPermit(input);
  }

  return yield* actions.signTypedData({ ...input.typedData, connector });
});

export const routeWalletTransaction = Effect.fn("routeWalletTransaction")(
  function* (routing: WalletRoutingContext, input: WalletSignTransactionInput) {
    const { actions, cosmosChainWallet, ledgerState, state } = routing;
    if (state.status !== "connected") {
      return yield* unavailable("transaction", state);
    }

    const { address, connector } = state;
    if (isStellarConnector(connector)) {
      return yield* makeStellarWalletDriver({ connector }).signTransaction({
        address,
        ...input,
      });
    }
    if (isLedgerLiveConnector(connector)) {
      return yield* makeLedgerWalletDriver({
        connector,
        currentAccountId: ledgerState.currentAccountId,
      }).signTransaction(input);
    }
    if (isSubstrateConnector(connector)) {
      return yield* makeSubstrateWalletDriver({ connector }).signTransaction(
        input
      );
    }
    if (isCosmosConnector(connector)) {
      return yield* makeCosmosWalletDriver({
        chainWallet: cosmosChainWallet,
        connector,
      }).signTransaction(input);
    }
    if (isTronConnector(connector)) {
      return yield* makeTronWalletDriver({ connector }).signTransaction(input);
    }
    if (isExternalProviderConnector(connector)) {
      return yield* makeExternalProviderWalletDriver({
        connector,
      }).signTransaction({
        address,
        ...input,
      });
    }
    if (isSolanaConnector(connector)) {
      return yield* makeSolanaWalletDriver({ connector }).signTransaction(
        input
      );
    }
    if (isCardanoConnector(connector)) {
      return yield* makeCardanoWalletDriver({ connector }).signTransaction(
        input
      );
    }
    if (isTonConnector(connector)) {
      return yield* makeTonWalletDriver({ connector }).signTransaction(input);
    }
    if (!isEvmAddress(address)) {
      return yield* new WalletDecodeError({
        cause: "Connected account is not an EVM address",
      });
    }
    if (isSafeConnector(connector)) {
      return yield* makeSafeWalletDriver({
        connector,
      }).signTransaction({
        address,
        family: input.family,
        tx: input.tx,
      });
    }

    return yield* makeEvmWalletDriver({
      sendTransaction: actions.sendEvmTransaction,
    }).signTransaction({
      account: address,
      connector,
      family: input.family,
      tx: input.tx,
    });
  }
);

export const routeWalletAccountSwitch = Effect.fn("routeWalletAccountSwitch")(
  function* (routing: WalletRoutingContext, input: WalletSwitchAccountInput) {
    const { ledgerState, state } = routing;
    if (
      state.status !== "connected" ||
      state.connector.uid !== input.connector.uid
    ) {
      return yield* unavailable("account", state);
    }

    return yield* makeLedgerWalletDriver({
      connector: state.connector,
      currentAccountId: ledgerState.currentAccountId,
    }).switchAccount(input);
  }
);

export const routeWalletLedgerAccountRequest = Effect.fn(
  "routeWalletLedgerAccountRequest"
)(function* (routing: WalletRoutingContext, targetChain?: Chain) {
  const { state } = routing;
  if (state.status !== "connected" || !isLedgerLiveConnector(state.connector)) {
    return { _tag: "RejectedUnavailable" } as const;
  }

  yield* state.connector.requestAndSwitchAccount(targetChain ?? state.chain);
  return { _tag: "Added" } as const;
});
