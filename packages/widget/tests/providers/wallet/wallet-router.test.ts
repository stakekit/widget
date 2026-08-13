import { Effect, Schema } from "effect";
import { type Chain, type Hash, type Hex, zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import type { Network } from "../../../src/domain/network/network";
import {
  routeWalletAccountSwitch,
  routeWalletLedgerAccountRequest,
  routeWalletTransaction,
  type WalletRoutingContext,
} from "../../../src/services/wallet/internal/runtime/router";
import type { WagmiActions } from "../../../src/services/wallet/internal/runtime/wagmi-actions";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../src/services/wallet/wallet-state";

const transactionInput = {
  family: "classic" as const,
  ledgerHwAppId: null,
  network: "ethereum" as Network,
  tx: JSON.stringify({
    chainId: 1,
    data: "0x",
    from: zeroAddress,
    gasLimit: "21000",
    gasPrice: "1",
    nonce: 1,
    to: zeroAddress,
    type: 0,
  }),
  txMeta: {} as never,
};

const makeConnector = (uid: string) =>
  ({ id: uid, uid }) as unknown as Connector;

const walletAddress = Schema.decodeSync(WalletAddress)(zeroAddress);

const connectedState = (
  connector: Connector
): Extract<NormalizedWalletState, { readonly status: "connected" }> => ({
  additionalAddresses: null,
  address: walletAddress,
  chain: { id: 1 } as Chain,
  connector,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
});

const actions = () =>
  ({
    connect: vi.fn(() => Effect.die("unused")),
    disconnect: vi.fn(() => Effect.die("unused")),
    reconnect: vi.fn(() => Effect.die("unused")),
    sendEvmTransaction: vi.fn(() =>
      Effect.succeed({
        broadcasted: true as const,
        signedTx: "0xhash" as Hash,
      })
    ),
    signMessage: vi.fn(() => Effect.succeed("0xsignature" as Hex)),
    switchChain: vi.fn(() => Effect.die("unused")),
  }) satisfies WagmiActions;

const routingContext = (
  state: NormalizedWalletState,
  walletActions = actions()
): WalletRoutingContext => ({
  actions: walletActions,
  cosmosChainWallet: null,
  ledgerState: disconnectedLedgerConnectorState,
  state,
});

describe("wallet router", () => {
  it("requests a Ledger account on the requested chain", async () => {
    const targetChain = { id: 10 } as Chain;
    const requestAndSwitchAccount = vi.fn(() => Effect.succeed(targetChain));
    const connector = {
      id: "ledgerLive",
      requestAndSwitchAccount,
      uid: "ledger",
    } as never;
    const state = {
      ...connectedState(connector),
      isLedgerLive: true,
      isLedgerLiveAccountPlaceholder: true,
    };

    const outcome = await Effect.runPromise(
      routeWalletLedgerAccountRequest(routingContext(state), targetChain)
    );

    expect(outcome).toEqual({ _tag: "Added" });
    expect(requestAndSwitchAccount).toHaveBeenCalledWith(targetChain);
  });

  it("fails commands with a typed capability error while disconnected", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        routeWalletTransaction(
          routingContext(disconnectedNormalizedWalletState),
          transactionInput
        )
      )
    );

    expect(failure).toMatchObject({
      _tag: "WalletCapabilityUnavailableError",
      capability: "transaction",
      connectorId: null,
    });
  });

  it("routes a generic EVM transaction through the bound Wagmi actions", async () => {
    const connector = makeConnector("evm");
    const walletActions = actions();

    await Effect.runPromise(
      routeWalletTransaction(
        routingContext(connectedState(connector), walletActions),
        transactionInput
      )
    );

    expect(walletActions.sendEvmTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ connector })
    );
  });

  it("rejects a stale Ledger account-switch command after wallet replacement", async () => {
    const first = makeConnector("first");
    const second = makeConnector("second");
    const failure = await Effect.runPromise(
      Effect.flip(
        routeWalletAccountSwitch(routingContext(connectedState(second)), {
          account: { id: "account" } as never,
          connector: first,
        })
      )
    );

    expect(failure._tag).toBe("WalletCapabilityUnavailableError");
  });
});
