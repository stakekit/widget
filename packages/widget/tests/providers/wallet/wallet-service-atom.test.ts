import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { type Chain, type Hex, zeroAddress } from "viem";
import { base } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { appRuntime } from "../../../src/app/runtime";
import { WalletAddress } from "../../../src/domain/schema/identifiers";
import { makeWalletServiceBindingAtom } from "../../../src/features/wallet/runtime/binding-atom";
import { disconnectedLedgerConnectorState } from "../../../src/features/wallet/state/ledger";
import type { NormalizedWalletState } from "../../../src/features/wallet/state/wallet";
import { WidgetPersistence } from "../../../src/services/persistence/widget-persistence";
import type { WagmiActions } from "../../../src/services/wallet/wagmi-actions";
import { WalletService } from "../../../src/services/wallet/wallet-service";

const connector = {
  id: "test",
  uid: "test-uid",
} as Connector;

const walletAddress = Schema.decodeSync(WalletAddress)(zeroAddress);

const firstState: NormalizedWalletState = {
  additionalAddresses: null,
  address: walletAddress,
  chain: base as Chain,
  connector,
  connectorChains: [base],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "base",
  status: "connected",
};

const secondState: NormalizedWalletState = {
  ...firstState,
  connectorChains: [],
};

const controller = (marker: Hex) => {
  const signMessage = vi.fn(() => Effect.succeed(marker));
  const actions = {
    connect: vi.fn(() => Effect.die("unused")),
    disconnect: vi.fn(() => Effect.die("unused")),
    reconnect: vi.fn(() => Effect.die("unused")),
    sendEvmTransaction: vi.fn(() => Effect.die("unused")),
    signMessage,
    switchChain: vi.fn(() => Effect.die("unused")),
  } satisfies WagmiActions;

  return { actions, signMessage };
};

const makeWalletRuntimeLayer = () => {
  const persistenceLayer = WidgetPersistence.layer;

  return WalletService.legacyLayer.pipe(
    Layer.provide(persistenceLayer),
    Layer.fresh
  );
};

const walletServiceProbeAtom = appRuntime.atom(
  WalletService.use((wallet) => Effect.succeed(wallet))
);

const makeHarness = (controllerValue: ReturnType<typeof controller>) => {
  const controllerAtom = Atom.make(AsyncResult.success(controllerValue));
  const stateAtom = Atom.make(AsyncResult.success(firstState));
  const bindingAtom = makeWalletServiceBindingAtom(
    controllerAtom,
    stateAtom,
    Atom.make(AsyncResult.success(disconnectedLedgerConnectorState)),
    Atom.make(AsyncResult.success(null))
  );
  const registry = AtomRegistry.make({
    initialValues: [[appRuntime.layer, makeWalletRuntimeLayer()]],
  });
  const unmountBinding = registry.mount(bindingAtom);

  return { controllerAtom, registry, stateAtom, unmountBinding };
};

describe("wallet service binding atom", () => {
  it("keeps an active command alive across state and controller publications", async () => {
    let resolveActiveCommand!: (value: Hex) => void;
    const firstController = controller("0xfirst");
    firstController.actions.signMessage = vi.fn(() =>
      Effect.promise(
        () =>
          new Promise<Hex>((resolve) => {
            resolveActiveCommand = resolve;
          })
      )
    );
    const replacementController = controller("0xreplacement");
    const { controllerAtom, registry, stateAtom, unmountBinding } =
      makeHarness(firstController);

    try {
      const stableService = AsyncResult.getOrThrow(
        registry.get(walletServiceProbeAtom)
      );
      const activeCommand = Effect.runPromise(
        stableService.signMessage({ message: "active" })
      );
      await vi.waitFor(() =>
        expect(resolveActiveCommand).toBeTypeOf("function")
      );

      registry.set(stateAtom, AsyncResult.success(secondState));
      registry.set(controllerAtom, AsyncResult.success(replacementController));
      await vi.waitFor(() =>
        expect(stableService.getState()).toBe(secondState)
      );

      resolveActiveCommand("0xfirst");
      await expect(activeCommand).resolves.toBe("0xfirst");
      await expect(
        Effect.runPromise(stableService.signMessage({ message: "next" }))
      ).resolves.toBe("0xreplacement");
      expect(replacementController.signMessage).toHaveBeenCalledOnce();
    } finally {
      unmountBinding();
      registry.dispose();
    }
  });

  it("keeps one service identity while live wallet state changes", async () => {
    const firstController = controller("0xfirst");
    const { registry, stateAtom, unmountBinding } =
      makeHarness(firstController);

    try {
      const stableService = AsyncResult.getOrThrow(
        registry.get(walletServiceProbeAtom)
      );

      registry.set(stateAtom, AsyncResult.success(secondState));
      await vi.waitFor(() =>
        expect(stableService.getState()).toBe(secondState)
      );
      expect(AsyncResult.getOrThrow(registry.get(walletServiceProbeAtom))).toBe(
        stableService
      );
    } finally {
      unmountBinding();
      registry.dispose();
    }
  });
});
