import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { appRuntime } from "../../../src/app/runtime";
import { WalletAddress } from "../../../src/domain/schema/identifiers";
import { makeWalletLifecycleAtom } from "../../../src/features/wallet/runtime/lifecycle";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../src/features/wallet/state/wallet";
import {
  defaultWidgetBootstrapConfig,
  WidgetBootstrapConfig,
} from "../../../src/services/config/widget-config";
import { TrackingService } from "../../../src/services/tracking/tracking-service";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const connector = { id: "test", uid: "test-uid" } as Connector;

const connectedState: NormalizedWalletState = {
  additionalAddresses: null,
  address,
  chain: mainnet,
  connector,
  connectorChains: [mainnet],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
};

const unsupportedState: NormalizedWalletState = {
  additionalAddresses: null,
  address,
  chain: mainnet,
  connector,
  connectorChains: [mainnet],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: null,
  network: null,
  status: "unsupported",
};

describe("wallet lifecycle atom", () => {
  it("tracks supported connections and disconnects unsupported ones once", async () => {
    const disconnect = vi.fn(() => Effect.void);
    const trackEvent = vi.fn();
    const controllerAtom = Atom.make(
      AsyncResult.success({ actions: { disconnect } })
    );
    const initialState: AsyncResult.AsyncResult<NormalizedWalletState, never> =
      AsyncResult.success(connectedState);
    const stateAtom = Atom.make(initialState);
    const lifecycleAtom = makeWalletLifecycleAtom(controllerAtom, stateAtom);
    const registry = AtomRegistry.make({
      initialValues: [
        [
          appRuntime.layer,
          TrackingService.layer.pipe(
            Layer.provide(
              WidgetBootstrapConfig.layer({
                ...defaultWidgetBootstrapConfig,
                tracking: {
                  tracking: { trackEvent },
                  variant: "default",
                },
              })
            )
          ),
        ],
      ],
    });
    const unmount = registry.mount(lifecycleAtom);

    try {
      await vi.waitFor(() =>
        expect(trackEvent).toHaveBeenCalledWith("Connected wallet", {
          address,
          network: "ethereum",
        })
      );

      registry.set(stateAtom, AsyncResult.success({ ...connectedState }));
      await Effect.runPromise(Effect.yieldNow);
      expect(trackEvent).toHaveBeenCalledTimes(1);

      registry.set(stateAtom, AsyncResult.success(unsupportedState));
      await vi.waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1));
      expect(disconnect).toHaveBeenCalledWith({ connector });

      registry.set(stateAtom, AsyncResult.success({ ...unsupportedState }));
      await Effect.runPromise(Effect.yieldNow);
      expect(disconnect).toHaveBeenCalledTimes(1);

      registry.set(
        stateAtom,
        AsyncResult.success(disconnectedNormalizedWalletState)
      );
      await Effect.runPromise(Effect.yieldNow);
      registry.set(stateAtom, AsyncResult.success(unsupportedState));
      await vi.waitFor(() => expect(disconnect).toHaveBeenCalledTimes(2));
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
