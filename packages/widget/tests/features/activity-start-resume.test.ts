import { Effect, Layer, Schema, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { startActivityResumeAtom } from "../../src/features/activity/state/start-activity-resume";
import { isActiveClassicTransactionFlowPathAtom } from "../../src/features/classic-transaction-flow/state";
import { walletConnectionStateAtom } from "../../src/features/wallet/state";
import {
  makeWidgetNavigation,
  WidgetNavigation,
  type WidgetNavigationOptions,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import { WalletScopeKey } from "../../src/services/wallet/wallet-scope";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { disconnectedLedgerConnectorState } from "../../src/services/wallet/wallet-state";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { makeClassicFlowTestWalletLayer } from "../utils/classic-flow-wallet-layer";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});
const connectedWallet = {
  additionalAddresses: null,
  address,
  chain: {} as never,
  connector: {} as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum" as const,
  status: "connected" as const,
};

const makeRegistry = (
  push: (path: WidgetPath, options?: WidgetNavigationOptions) => void,
  serviceConnection = connectedWallet
) => {
  const navigation = makeWidgetNavigation({
    back: () => Effect.void,
    push: (path, options) => Effect.sync(() => push(path, options)),
    replace: () => Effect.void,
  });
  const state = {
    connection: serviceConnection,
    ledger: disconnectedLedgerConnectorState,
  };
  return AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(WidgetNavigation, navigation)
      ),
      Atom.initialValue(
        walletRuntime.layer,
        makeClassicFlowTestWalletLayer({
          navigation,
          wallet: WalletService.of({
            state: Effect.succeed(state),
            states: Stream.succeed(state),
            wagmiConfig: {},
          } as never),
        }) as never
      ),
      Atom.initialValue(walletConnectionStateAtom, connectedWallet),
    ],
  });
};

describe("Activity resume action", () => {
  it("preserves the closed Classic owner rejection", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push, {
      ...connectedWallet,
      address: Schema.decodeSync(WalletAddress)(
        "0x2234567890123456789012345678901234567890"
      ),
    });
    const selectedYield = yieldApiYieldFixture();

    try {
      registry.set(startActivityResumeAtom, {
        item: {
          actionData: yieldApiActionFixture({
            status: "CREATED",
            yieldId: selectedYield.id,
          }),
          validatorsData: [],
          walletScope,
          yieldData: selectedYield,
        },
        providersDetails: [],
        presentation: "Classic",
      });

      await vi.waitFor(() =>
        expect(
          AsyncResult.isSuccess(registry.get(startActivityResumeAtom))
        ).toBe(true)
      );
      expect(
        AsyncResult.getOrThrow(registry.get(startActivityResumeAtom))
      ).toEqual({ _tag: "Rejected", reason: "RejectedOwner" });
      expect(push).not.toHaveBeenCalled();
    } finally {
      registry.dispose();
    }
  });

  it("starts the Flow Session and navigates a resumable action to Review", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);
    const selectedYield = yieldApiYieldFixture();
    const action = yieldApiActionFixture({
      status: "CREATED",
      yieldId: selectedYield.id,
    });

    try {
      registry.set(startActivityResumeAtom, {
        item: {
          actionData: action,
          validatorsData: [],
          walletScope,
          yieldData: selectedYield,
        },
        providersDetails: [],
        presentation: "Classic",
      });

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      expect(push).toHaveBeenCalledWith("/activity/review", {
        _tag: "Push",
        path: "/activity/review",
      });
      expect(
        registry.get(isActiveClassicTransactionFlowPathAtom("/activity/review"))
      ).toBe(true);
    } finally {
      registry.dispose();
    }
  });

  it("navigates a completed action with explorer state from the Atom command", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);
    const selectedYield = yieldApiYieldFixture();
    const transaction = yieldApiTransactionFixture({
      explorerUrl: "https://explorer.example/transaction",
      type: "STAKE",
    });

    try {
      registry.set(startActivityResumeAtom, {
        item: {
          actionData: yieldApiActionFixture({
            status: "SUCCESS",
            transactions: [transaction],
            type: "STAKE",
            yieldId: selectedYield.id,
          }),
          validatorsData: [],
          walletScope,
          yieldData: selectedYield,
        },
        providersDetails: [],
        presentation: "Classic",
      });

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      expect(push).toHaveBeenCalledWith(
        "/activity/stake-review/complete",
        expect.objectContaining({
          state: {
            urls: [
              {
                type: transaction.type,
                url: transaction.explorerUrl,
              },
            ],
          },
        })
      );
    } finally {
      registry.dispose();
    }
  });

  it.each(["CANCELED", "STALE"] as const)(
    "does not start a Flow Session for a %s action",
    async (status) => {
      const push = vi.fn();
      const registry = makeRegistry(push);
      const selectedYield = yieldApiYieldFixture();

      try {
        registry.set(startActivityResumeAtom, {
          item: {
            actionData: yieldApiActionFixture({
              status,
              yieldId: selectedYield.id,
            }),
            validatorsData: [],
            walletScope,
            yieldData: selectedYield,
          },
          providersDetails: [],
          presentation: "Classic",
        });

        await Promise.resolve();

        expect(push).not.toHaveBeenCalled();
        expect(
          registry.get(
            isActiveClassicTransactionFlowPathAtom("/activity/review")
          )
        ).toBe(false);
      } finally {
        registry.dispose();
      }
    }
  );
});
