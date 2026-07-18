import type { ChainWalletBase } from "@cosmos-kit/core";
import { Effect } from "effect";
import type { Address } from "viem";
import { isCosmosConnector } from "./connectors/cosmos/cosmos-connector-meta";
import { isExternalProviderConnector } from "./connectors/external-provider";
import { isLedgerLiveConnector } from "./connectors/ledger/ledger-live-connector-meta";
import { isCardanoConnector } from "./connectors/misc/cardano-connector-meta";
import { isSolanaConnector } from "./connectors/misc/solana-connector-meta";
import { isTonConnector } from "./connectors/misc/ton-connector-meta";
import { isTronConnector } from "./connectors/misc/tron-connector-meta";
import { isSafeConnector } from "./connectors/safe/safe-connector-meta";
import { isSubstrateConnector } from "./connectors/substrate/substrate-connector-meta";
import type {
  WalletSignMessageInput,
  WalletSwitchAccountInput,
} from "./domain/commands";
import { WalletCapabilityUnavailableError } from "./domain/errors";
import type {
  LedgerConnectorState,
  NormalizedWalletState,
} from "./domain/state";
import type { WalletSignTransactionInput } from "./domain/transactions";
import { makeCosmosWalletDriver } from "./drivers/cosmos";
import { makeEvmWalletDriver } from "./drivers/evm";
import { makeExternalProviderWalletDriver } from "./drivers/external-provider";
import { makeLedgerWalletDriver } from "./drivers/ledger";
import {
  makeCardanoWalletDriver,
  makeSolanaWalletDriver,
  makeTonWalletDriver,
  makeTronWalletDriver,
} from "./drivers/misc";
import { makeSafeWalletDriver } from "./drivers/safe";
import { makeSubstrateWalletDriver } from "./drivers/substrate";
import type { WagmiActions } from "./wagmi-actions";

export type WalletRoutingContext = {
  readonly actions: WagmiActions;
  readonly cosmosChainWallet: ChainWalletBase | null;
  readonly ledgerState: LedgerConnectorState;
  readonly state: NormalizedWalletState;
};

const unavailable = (
  capability: "account" | "message" | "transaction",
  state: NormalizedWalletState
) =>
  new WalletCapabilityUnavailableError({
    capability,
    connectorId: state.connector?.id ?? null,
  });

export const routeWalletMessage = Effect.fn("routeWalletMessage")(function* (
  routing: WalletRoutingContext,
  input: WalletSignMessageInput
) {
  const { actions, state } = routing;
  if (state.status !== "connected") {
    return yield* unavailable("message", state);
  }

  return yield* isExternalProviderConnector(state.connector)
    ? makeExternalProviderWalletDriver({
        connector: state.connector,
      }).signMessage(input)
    : actions.signMessage({
        ...input,
        connector: state.connector,
      });
});

export const routeWalletTransaction = Effect.fn("routeWalletTransaction")(
  function* (routing: WalletRoutingContext, input: WalletSignTransactionInput) {
    const { actions, cosmosChainWallet, ledgerState, state } = routing;
    if (state.status !== "connected") {
      return yield* unavailable("transaction", state);
    }

    const { address, connector } = state;
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
        address: address as Address,
        network: input.network,
        tx: input.tx,
        txMeta: input.txMeta,
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
    if (isSafeConnector(connector)) {
      return yield* makeSafeWalletDriver({ connector }).signTransaction({
        address: address as Address,
        tx: input.tx,
      });
    }

    return yield* makeEvmWalletDriver({
      sendTransaction: actions.sendEvmTransaction,
    }).signTransaction({
      account: address as Address,
      connector,
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
