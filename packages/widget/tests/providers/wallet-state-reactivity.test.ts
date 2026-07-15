import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { mainnet, optimism } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { appRuntime } from "../../src/app/runtime";
import { evmChainsMap } from "../../src/domain/types/chains/evm";
import {
  currentWalletLedgerStateAtom,
  currentWalletStateAtom,
  currentWalletStateResultAtom,
  walletStateAtom,
} from "../../src/features/wallet";
import { walletLedgerStateAtom } from "../../src/features/wallet/runtime/root-atom";
import {
  disconnectedWalletConnection,
  type WalletConnectionSnapshot,
} from "../../src/features/wallet/state/connection";
import { disconnectedLedgerConnectorState } from "../../src/features/wallet/state/ledger";
import {
  disconnectedNormalizedWalletState,
  makeWalletStateAtom,
  type WalletStateController,
} from "../../src/features/wallet/state/wallet";
import {
  type WalletInitializationKey,
  walletInitializationKeyAtom,
} from "../../src/features/wallet/wagmi/initialization";

const firstAddress = "0x0000000000000000000000000000000000000001";
const replacementAddress = "0x0000000000000000000000000000000000000002";

const connection = ({
  address,
  chain = mainnet,
  connector,
}: {
  readonly address: `0x${string}`;
  readonly chain?: typeof mainnet | typeof optimism;
  readonly connector: Connector;
}) =>
  ({
    ...disconnectedWalletConnection,
    address,
    addresses: [address],
    chain,
    chainId: chain.id,
    connector,
    isConnected: true,
    isDisconnected: false,
    status: "connected",
  }) as WalletConnectionSnapshot;

describe("wallet state reactivity", () => {
  it("selects current wallet and ledger projections from the topology key atom", () => {
    const initializationKey = {} as WalletInitializationKey;
    const walletResult = AsyncResult.success(disconnectedNormalizedWalletState);
    const ledgerResult = AsyncResult.success(disconnectedLedgerConnectorState);
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(walletInitializationKeyAtom, initializationKey),
        Atom.initialValue(walletStateAtom(initializationKey), walletResult),
        Atom.initialValue(
          walletLedgerStateAtom(initializationKey),
          ledgerResult
        ),
      ],
    });

    expect(registry.get(currentWalletStateResultAtom)).toBe(walletResult);
    expect(registry.get(currentWalletStateAtom)).toBe(
      disconnectedNormalizedWalletState
    );
    expect(
      AsyncResult.getOrThrow(registry.get(currentWalletLedgerStateAtom))
    ).toEqual(disconnectedLedgerConnectorState);
  });

  it("publishes connector, account, and chain changes without replacing runtimes", async () => {
    const firstConnector = { id: "first" } as Connector;
    const replacementConnector = { id: "replacement" } as Connector;
    const controller: WalletStateController = {
      cosmosConfig: { cosmosChainsMap: {} },
      evmConfig: { evmChainsMap: { ethereum: evmChainsMap.ethereum } },
      isLedgerLive: false,
      miscConfig: { miscChainsMap: {} },
      substrateConfig: { substrateChainsMap: {} },
    };
    const controllerAtom = Atom.make(AsyncResult.success(controller));
    const connectionAtom = Atom.make(
      AsyncResult.success(
        connection({ address: firstAddress, connector: firstConnector })
      )
    );
    const connectorChainsAtom = Atom.make(AsyncResult.success([mainnet]));
    const ledgerStateAtom = Atom.make(
      AsyncResult.success(disconnectedLedgerConnectorState)
    );
    const additionalAddressesAtom = Atom.make(AsyncResult.success(null));
    const stateAtom = makeWalletStateAtom(
      controllerAtom,
      connectionAtom,
      connectorChainsAtom,
      ledgerStateAtom,
      additionalAddressesAtom
    );
    const stateAtomIdentity = stateAtom;
    const registry = AtomRegistry.make();
    let latest = registry.get(stateAtom);
    const unsubscribe = registry.subscribe(
      stateAtom,
      (result) => {
        latest = result;
      },
      { immediate: true }
    );
    const runtimeIdentity = appRuntime;

    await vi.waitFor(() => {
      expect(AsyncResult.isSuccess(latest) && latest.value).toMatchObject({
        address: firstAddress,
        connector: firstConnector,
        status: "connected",
      });
    });

    registry.set(
      connectionAtom,
      AsyncResult.success(
        connection({
          address: firstAddress,
          chain: optimism,
          connector: replacementConnector,
        })
      )
    );
    await vi.waitFor(() => {
      expect(AsyncResult.isSuccess(latest) && latest.value).toMatchObject({
        chain: optimism,
        connector: replacementConnector,
        status: "unsupported",
      });
    });

    registry.set(
      connectionAtom,
      AsyncResult.success(
        connection({
          address: replacementAddress,
          connector: replacementConnector,
        })
      )
    );
    await vi.waitFor(() => {
      expect(AsyncResult.isSuccess(latest) && latest.value).toMatchObject({
        address: replacementAddress,
        chain: mainnet,
        connector: replacementConnector,
        status: "connected",
      });
    });

    expect(stateAtom).toBe(stateAtomIdentity);
    expect(appRuntime).toBe(runtimeIdentity);

    unsubscribe();
    registry.dispose();
  });
});
