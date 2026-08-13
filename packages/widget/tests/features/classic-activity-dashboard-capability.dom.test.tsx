import { RegistryProvider, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect, Layer, Schema, Stream } from "effect";
import type { PropsWithChildren } from "react";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import {
  activityResumeDashboardViewAtom,
  startClassicTransactionFlowAtom,
  useAbandonActivityResume,
} from "../../src/features/classic-transaction-flow/state";
import { walletScopeAtom } from "../../src/features/wallet/state";
import {
  makeWidgetNavigation,
  WidgetNavigation,
  type WidgetNavigationOptions,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import { WalletScopeKey } from "../../src/services/wallet/wallet-scope";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { disconnectedLedgerConnectorState } from "../../src/services/wallet/wallet-state";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";
import { makeClassicFlowTestWalletLayer } from "../utils/classic-flow-wallet-layer";
import { describe, expect, it, vi } from "../utils/test-extend.dom.ts";
import { renderHook } from "../utils/test-utils.dom.tsx";

const walletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x1234567890123456789012345678901234567890"
  ),
  network: "ethereum",
});

const makeStartCommand = () => {
  const selectedYield = yieldApiYieldFixture();
  return {
    intake: {
      _tag: "ActivityResume",
      action: yieldApiActionFixture({
        status: "SUCCESS",
        type: "STAKE",
        yieldId: selectedYield.id,
      }),
      providersDetails: [],
      selectedValidators: [],
      selectedYield,
      walletScope,
    },
    mount: {
      _tag: "ActivityResume",
      presentation: "Dashboard",
      target: "HistoricalDetails",
    },
  } as const;
};

describe("Dashboard Activity Resume capability", () => {
  it("binds abandonment to the observed Flow Session", async () => {
    const push =
      vi.fn<(path: WidgetPath, options?: WidgetNavigationOptions) => void>();
    const navigationLayer = Layer.succeed(
      WidgetNavigation,
      makeWidgetNavigation({
        back: () => Effect.void,
        push: (path, options) => Effect.sync(() => push(path, options)),
        replace: () => Effect.void,
      })
    );
    const walletState = {
      connection: {
        additionalAddresses: null,
        address: walletScope.address,
        chain: {} as never,
        connector: {} as never,
        connectorChains: [],
        isLedgerLive: false,
        isLedgerLiveAccountPlaceholder: false,
        ledgerAccounts: [],
        network: walletScope.network,
        status: "connected" as const,
      },
      ledger: disconnectedLedgerConnectorState,
    };
    const walletLayer = makeClassicFlowTestWalletLayer({
      navigation: makeWidgetNavigation({
        back: () => Effect.void,
        push: (path, options) => Effect.sync(() => push(path, options)),
        replace: () => Effect.void,
      }),
      wallet: WalletService.of({
        state: Effect.succeed(walletState),
        states: Stream.succeed(walletState),
        wagmiConfig: {},
      } as never),
    });
    const Wrapper = ({ children }: PropsWithChildren) => (
      <RegistryProvider
        initialValues={[
          [appRuntime.layer, navigationLayer],
          [walletScopeAtom, walletScope],
          [walletRuntime.layer, walletLayer],
        ]}
      >
        {children}
      </RegistryProvider>
    );

    const { act, result } = await renderHook(
      () => ({
        abandon: useAbandonActivityResume(),
        start: useAtomSet(startClassicTransactionFlowAtom),
        view: useAtomValue(activityResumeDashboardViewAtom),
      }),
      { wrapper: Wrapper }
    );

    await act(async () => result.current.start(makeStartCommand()));
    await expect.poll(() => result.current.view._tag).toBe("Open");
    const firstAbandon = result.current.abandon;

    await act(async () => result.current.start(makeStartCommand()));
    await expect.poll(() => result.current.abandon).not.toBe(firstAbandon);

    await act(async () => firstAbandon(undefined));
    expect(result.current.view._tag).toBe("Open");
    expect(push).not.toHaveBeenCalled();

    await act(async () => result.current.abandon(undefined));
    await expect.poll(() => result.current.view._tag).toBe("Closed");
    expect(push).toHaveBeenCalledWith("/activity", {
      _tag: "Push",
      path: "/activity",
    });
  });
});
