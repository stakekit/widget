import type { ChainWalletBase } from "@cosmos-kit/core";
import type { Chain } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import type { Address } from "viem";
import type {
  WalletSignMessageInput,
  WalletSwitchAccountInput,
} from "../../wallet-commands";
import { WalletCapabilityUnavailableError } from "../../wallet-errors";
import type {
  LedgerConnectorState,
  NormalizedWalletState,
} from "../../wallet-state";
import type { WalletSignTransactionInput } from "../../wallet-transactions";
import { isCardanoConnector } from "../adapters/cardano/cardano-connector-meta";
import { makeCardanoWalletDriver } from "../adapters/cardano/driver";
import { isCosmosConnector } from "../adapters/cosmos/cosmos-connector-meta";
import { makeCosmosWalletDriver } from "../adapters/cosmos/driver";
import { makeEvmWalletDriver } from "../adapters/evm/driver";
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

  if (isStellarConnector(state.connector)) {
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
        address: address as Address,
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
    if (isSafeConnector(connector)) {
      return yield* makeSafeWalletDriver({
        connector,
      }).signTransaction({
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
