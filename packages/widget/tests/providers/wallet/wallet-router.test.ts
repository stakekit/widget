import { Effect, Schema } from "effect";
import { type Chain, type Hash, type Hex, zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { WalletAddress } from "../../../src/domain/schema/identifiers";
import type { Network } from "../../../src/domain/schema/network-model";
import {
  routeWalletAccountSwitch,
  routeWalletTransaction,
  type WalletBinding,
} from "../../../src/providers/wallet/runtime/router";
import { disconnectedLedgerConnectorState } from "../../../src/providers/wallet/state/ledger";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../src/providers/wallet/state/wallet";
import type { WagmiActions } from "../../../src/providers/wallet/wagmi/actions";

const transactionInput = {
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

const connectedState = (connector: Connector): NormalizedWalletState => ({
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

const binding = (
  state: NormalizedWalletState,
  walletActions = actions()
): WalletBinding => ({
  actions: walletActions,
  cosmosChainWallet: null,
  ledgerState: disconnectedLedgerConnectorState,
  state,
});

describe("wallet router", () => {
  it("fails commands with a typed capability error while disconnected", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        routeWalletTransaction(
          binding(disconnectedNormalizedWalletState),
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
        binding(connectedState(connector), walletActions),
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
        routeWalletAccountSwitch(binding(connectedState(second)), {
          account: { id: "account" } as never,
          connector: first,
        })
      )
    );

    expect(failure._tag).toBe("WalletCapabilityUnavailableError");
  });
});
