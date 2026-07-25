import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import { resumeActivityActionAtom } from "../../src/features/activity/state/resume-action";
import { classicFlowSessionStore } from "../../src/features/classic-transaction-flow/facade";
import { walletConnectionStateAtom } from "../../src/features/wallet/public-state";
import {
  WidgetNavigation,
  type WidgetNavigationOptions,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../fixtures";

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
  push: (path: WidgetPath, options?: WidgetNavigationOptions) => void
) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(
          WidgetNavigation,
          WidgetNavigation.of({
            back: () => Effect.void,
            push: (path, options) => Effect.sync(() => push(path, options)),
            replace: () => Effect.void,
          })
        )
      ),
      Atom.initialValue(walletConnectionStateAtom, connectedWallet),
    ],
  });

describe("Activity resume action", () => {
  it("starts the Flow Session and navigates a resumable action to Review", async () => {
    const push = vi.fn();
    const registry = makeRegistry(push);
    const selectedYield = yieldApiYieldFixture();
    const action = yieldApiActionFixture({
      status: "CREATED",
      yieldId: selectedYield.id,
    });

    try {
      registry.set(resumeActivityActionAtom, {
        action,
        providersDetails: [],
        selectionMode: "navigate",
        validators: [],
        walletScope,
        yield: selectedYield,
      });

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      expect(push).toHaveBeenCalledWith("/activity/review", {
        _tag: "Push",
        path: "/activity/review",
      });
      expect(
        registry.get(classicFlowSessionStore.currentSessionAtom)?.intake
      ).toMatchObject({
        _tag: "ActivityResume",
        action: { id: action.id },
      });
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
      registry.set(resumeActivityActionAtom, {
        action: yieldApiActionFixture({
          status: "SUCCESS",
          transactions: [transaction],
          type: "STAKE",
          yieldId: selectedYield.id,
        }),
        providersDetails: [],
        selectionMode: "navigate",
        validators: [],
        walletScope,
        yield: selectedYield,
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
});
