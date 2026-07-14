import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { mainnet, optimism } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { borrowAtomRuntime } from "../../src/borrow/runtime";
import { evmChainsMap } from "../../src/domain/types/chains/evm";
import { widgetAtomRuntime } from "../../src/providers/effect-atom-runtime/widget-runtime";
import {
  disconnectedWalletConnection,
  type WalletConnectionSnapshot,
} from "../../src/providers/wallet/state/connection";
import { disconnectedLedgerConnectorState } from "../../src/providers/wallet/state/ledger";
import {
  makeWalletStateAtom,
  type WalletStateController,
} from "../../src/providers/wallet/state/wallet";

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
    const runtimeIdentities = {
      borrowAtomRuntime,
      widgetAtomRuntime,
    };

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
    expect({
      borrowAtomRuntime,
      widgetAtomRuntime,
    }).toEqual(runtimeIdentities);

    unsubscribe();
    registry.dispose();
  });
});
