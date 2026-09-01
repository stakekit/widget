import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { type Chain, type Hash, type Hex, zeroAddress } from "viem";
import type { Connector } from "wagmi";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import type { Network } from "../../../src/domain/network/network";
import {
  routeWalletAccountSwitch,
  routeWalletLedgerAccountRequest,
  routeWalletMessage,
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
  it.effect("requests a Ledger account on the requested chain", () =>
    Effect.gen(function* () {
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

      const outcome = yield* routeWalletLedgerAccountRequest(
        routingContext(state),
        targetChain
      );

      expect(outcome).toEqual({ _tag: "Added" });
      expect(requestAndSwitchAccount).toHaveBeenCalledWith(targetChain);
    })
  );

  it.effect(
    "fails commands with a typed capability error while disconnected",
    () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(
          routeWalletTransaction(
            routingContext(disconnectedNormalizedWalletState),
            transactionInput
          )
        );

        expect(failure).toMatchObject({
          _tag: "WalletCapabilityUnavailableError",
          capability: "transaction",
          connectorId: null,
        });
      })
  );

  it.effect(
    "routes a generic EVM transaction through the bound Wagmi actions",
    () =>
      Effect.gen(function* () {
        const connector = makeConnector("evm");
        const walletActions = actions();

        yield* routeWalletTransaction(
          routingContext(connectedState(connector), walletActions),
          transactionInput
        );

        expect(walletActions.sendEvmTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ connector })
        );
      })
  );

  it.effect("routes Stellar transactions through the generic connector", () =>
    Effect.gen(function* () {
      const stellarAddress = `G${"A".repeat(55)}`;
      const signTransaction = vi.fn(() =>
        Effect.succeed({
          signedTxXdr: "signed-xdr",
        })
      );
      const connector = {
        id: "freighter",
        signTransaction,
        type: "stellar-wallet",
        uid: "freighter",
      } as unknown as Connector;
      const walletActions = actions();
      const state = {
        ...connectedState(connector),
        address: Schema.decodeSync(WalletAddress)(stellarAddress),
        network: "stellar" as const,
      };

      expect(
        yield* routeWalletTransaction(routingContext(state, walletActions), {
          ...transactionInput,
          network: "stellar" as Network,
          tx: "AAAA",
        })
      ).toEqual({ broadcasted: false, signedTx: "signed-xdr" });
      expect(signTransaction).toHaveBeenCalledWith({
        address: stellarAddress,
        networkPassphrase: "Public Global Stellar Network ; September 2015",
        transactionXdr: "AAAA",
      });
      expect(walletActions.sendEvmTransaction).not.toHaveBeenCalled();
    })
  );

  it.effect("rejects Stellar message signing before the Wagmi fallback", () =>
    Effect.gen(function* () {
      const connector = {
        id: "freighter",
        type: "stellar-wallet",
        uid: "freighter",
      } as unknown as Connector;
      const walletActions = actions();

      const failure = yield* Effect.flip(
        routeWalletMessage(
          routingContext(connectedState(connector), walletActions),
          { message: "hello" }
        )
      );

      expect(failure).toMatchObject({
        _tag: "WalletCapabilityUnavailableError",
        capability: "message",
        connectorId: "freighter",
      });
      expect(walletActions.signMessage).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "rejects a stale Ledger account-switch command after wallet replacement",
    () =>
      Effect.gen(function* () {
        const first = makeConnector("first");
        const second = makeConnector("second");
        const failure = yield* Effect.flip(
          routeWalletAccountSwitch(routingContext(connectedState(second)), {
            account: { id: "account" } as never,
            connector: first,
          })
        );

        expect(failure._tag).toBe("WalletCapabilityUnavailableError");
      })
  );
});
