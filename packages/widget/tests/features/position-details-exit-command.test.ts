import BigNumber from "bignumber.js";
import { Deferred, Effect, Layer, Schema, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { EarnBalance } from "../../src/domain/schema/earn-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import { isActiveClassicTransactionFlowPathAtom } from "../../src/features/classic-transaction-flow/state";
import { currentClassicFlowSessionAtom } from "../../src/features/classic-transaction-flow/state/atoms/classic-flow";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../src/features/portfolio/state";
import {
  openPositionPendingActionModalAtom,
  positionPendingActionModalViewAtom,
  runPositionPendingActionAtom,
  setPositionDetailsExitMaxAmountAtom,
  submitPositionDetailsExitAtom,
} from "../../src/features/position-details/state/classic-flow-actions";
import {
  PositionDetailsWorkflowKey,
  positionDetailsWorkflowAtom,
} from "../../src/features/position-details/state/workflow";
import { walletConnectionStateAtom } from "../../src/features/wallet/state";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../src/resources/yield-opportunity/provider";
import {
  makeWidgetNavigation,
  WidgetNavigation,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  disconnectedLedgerConnectorState,
  type NormalizedWalletState,
} from "../../src/services/wallet/domain/state";
import { WalletService } from "../../src/services/wallet/wallet-service";
import {
  yieldApiValidatorFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../fixtures";
import { makeClassicFlowTestWalletLayer } from "../utils/classic-flow-wallet-layer";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x2234567890123456789012345678901234567890"
);
const sameAddressDifferentCase = Schema.decodeSync(WalletAddress)(
  address.toUpperCase()
);
const scope = new WalletScopeKey({ address, network: "ethereum" });
const baseYield = yieldApiYieldFixture();
const selectedYield = yieldApiYieldFixture({
  metadata: {
    ...baseYield.metadata,
    supportedStandards: ["ERC4626"],
  },
});
const balance = Schema.decodeUnknownSync(EarnBalance)(
  yieldBalanceFixture({
    address,
    amount: "1",
    token: selectedYield.token,
  })
);
const manageBalance = Schema.decodeUnknownSync(EarnBalance)(
  yieldBalanceFixture({
    address,
    amount: "1",
    pendingActions: [
      {
        amount: "1",
        arguments: { fields: [] },
        intent: "manage",
        passthrough: "wallet-a-action",
        type: "CLAIM_REWARDS",
      },
    ],
    token: selectedYield.token,
  })
);
const manageAction = manageBalance.pendingActions[0]!;
const workflowKey = new PositionDetailsWorkflowKey({
  balanceId: "balance-1",
  integrationId: selectedYield.id,
  pendingActionType: null,
  scope,
});
const positionKey = new PositionBalancesKey({
  balanceId: workflowKey.balanceId,
  scope,
  yieldId: selectedYield.id,
});

const makeConnectedWallet = (
  overrides: Partial<
    Extract<NormalizedWalletState, { readonly status: "connected" }>
  > = {}
): Extract<NormalizedWalletState, { readonly status: "connected" }> => ({
  additionalAddresses: null,
  address,
  chain: {} as never,
  connector: {} as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
  ...overrides,
});

const makeRegistry = ({
  push,
  serviceWallet,
  trackEvent,
  wallet = makeConnectedWallet(),
  yieldBalance = balance,
  yieldOpportunity = selectedYield,
}: {
  readonly push: ReturnType<typeof vi.fn<(path: WidgetPath) => void>>;
  readonly serviceWallet?: NormalizedWalletState;
  readonly trackEvent: TrackingService["Service"]["trackEvent"];
  readonly wallet?: NormalizedWalletState;
  readonly yieldBalance?: typeof EarnBalance.Type;
  readonly yieldOpportunity?: typeof selectedYield;
}) => {
  const navigation = makeWidgetNavigation({
    back: () => Effect.void,
    push: (path) => Effect.sync(() => push(path)),
    replace: () => Effect.void,
  });
  const walletState = {
    connection: serviceWallet ?? wallet,
    ledger: disconnectedLedgerConnectorState,
  };
  return AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Layer.succeed(WidgetNavigation, navigation),
          Layer.succeed(
            TrackingService,
            TrackingService.of({
              trackEvent,
              trackPageView: () => Effect.void,
            })
          )
        ) as never
      ),
      Atom.initialValue(
        walletRuntime.layer,
        makeClassicFlowTestWalletLayer({
          navigation,
          wallet: WalletService.of({
            state: Effect.succeed(walletState),
            states: Stream.succeed(walletState),
            wagmiConfig: {},
          } as never),
        }) as never
      ),
      Atom.initialValue(walletConnectionStateAtom, wallet),
      Atom.initialValue(
        yieldOpportunityAtom(
          new YieldOpportunityKey({ yieldId: selectedYield.id })
        ),
        AsyncResult.success(yieldOpportunity)
      ),
      Atom.initialValue(
        positionBalancesAtom(positionKey),
        AsyncResult.success({
          balances: [yieldBalance],
          rewardRate: null,
          type: "default" as const,
        })
      ),
      Atom.initialValue(
        positionBalancesByTypeAtom(positionKey),
        AsyncResult.success(
          new Map([
            [
              "active",
              [{ ...yieldBalance, tokenPriceInUsd: new BigNumber(1) }],
            ],
          ])
        )
      ),
    ],
  });
};

describe("Position Details exit command", () => {
  it("preserves the closed Classic rejection for Exit", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const registry = makeRegistry({
      push,
      serviceWallet: makeConnectedWallet({ address: otherAddress }),
      trackEvent: () => Effect.void,
    });
    const commandAtom = submitPositionDetailsExitAtom(workflowKey);

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        pendingActions: new Map(),
        unstakeAmount: new BigNumber("0.4"),
        unstakeUseMaxAmount: false,
      });
      registry.set(commandAtom, undefined);

      await vi.waitFor(() =>
        expect(AsyncResult.isSuccess(registry.get(commandAtom))).toBe(true)
      );
      expect(AsyncResult.getOrThrow(registry.get(commandAtom))).toEqual({
        _tag: "Rejected",
        reason: "RejectedOwner",
      });
      expect(push).not.toHaveBeenCalled();
    } finally {
      registry.dispose();
    }
  });

  it("preserves the closed Classic rejection for a Pending Action", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const registry = makeRegistry({
      push,
      serviceWallet: makeConnectedWallet({ address: otherAddress }),
      trackEvent: () => Effect.void,
      yieldBalance: manageBalance,
    });
    const commandAtom = runPositionPendingActionAtom(workflowKey);

    try {
      registry.set(commandAtom, {
        _tag: "Select",
        pendingActionDto: manageAction,
        yieldBalance: manageBalance,
      });

      await vi.waitFor(() =>
        expect(AsyncResult.isSuccess(registry.get(commandAtom))).toBe(true)
      );
      expect(AsyncResult.getOrThrow(registry.get(commandAtom))).toEqual({
        _tag: "Rejected",
        attemptId: null,
        reason: "RejectedOwner",
      });
      expect(push).not.toHaveBeenCalled();
    } finally {
      registry.dispose();
    }
  });

  it("does not order Pending Action start behind telemetry", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackingRelease = await Effect.runPromise(Deferred.make<void>());
    const registry = makeRegistry({
      push,
      trackEvent: () => Deferred.await(trackingRelease),
      yieldBalance: manageBalance,
    });
    const commandAtom = runPositionPendingActionAtom(workflowKey);

    try {
      registry.set(commandAtom, {
        _tag: "Select",
        pendingActionDto: manageAction,
        yieldBalance: manageBalance,
      });

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      await vi.waitFor(() =>
        expect(AsyncResult.isSuccess(registry.get(commandAtom))).toBe(true)
      );
      expect(AsyncResult.getOrThrow(registry.get(commandAtom))).toMatchObject({
        _tag: "Started",
      });
      await Effect.runPromise(Deferred.succeed(trackingRelease, undefined));
    } finally {
      registry.dispose();
    }
  });

  it.each([
    { name: "validatorAddress", type: "string" },
    { name: "validatorAddresses", type: "string" },
    { name: "subnetId", type: "number" },
  ] as const)(
    "does not start Exit without required $name mechanics",
    async ({ name, type }) => {
      const push = vi.fn<(path: WidgetPath) => void>();
      const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
        () => Effect.void
      );
      const yieldDto = yieldApiYieldDtoFixture();
      const requiredYield = yieldApiYieldFixture({
        mechanics: {
          ...yieldDto.mechanics,
          arguments: {
            ...yieldDto.mechanics.arguments,
            exit: {
              fields: [{ label: name, name, required: true, type }],
            },
          },
        },
      });
      const registry = makeRegistry({
        push,
        trackEvent,
        yieldOpportunity: requiredYield,
      });

      try {
        registry.set(positionDetailsWorkflowAtom(workflowKey), {
          pendingActions: new Map(),
          unstakeAmount: new BigNumber("0.4"),
          unstakeUseMaxAmount: false,
        });
        registry.set(submitPositionDetailsExitAtom(workflowKey), undefined);

        await Promise.resolve();

        expect(push).not.toHaveBeenCalled();
        expect(
          registry.get(
            isActiveClassicTransactionFlowPathAtom(
              `/positions/${selectedYield.id}/balance-1/unstake/review`
            )
          )
        ).toBe(false);
      } finally {
        registry.dispose();
      }
    }
  );

  it("starts Exit from a valid displayed partial amount", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({ push, trackEvent });

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        pendingActions: new Map(),
        unstakeAmount: new BigNumber("0.4"),
        unstakeUseMaxAmount: false,
      });
      registry.set(submitPositionDetailsExitAtom(workflowKey), undefined);

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      expect(push).toHaveBeenCalledWith(
        `/positions/${selectedYield.id}/balance-1/unstake/review`
      );
      expect(
        registry.get(
          isActiveClassicTransactionFlowPathAtom(
            `/positions/${selectedYield.id}/balance-1/unstake/review`
          )
        )
      ).toBe(true);
    } finally {
      registry.dispose();
    }
  });

  it("includes every required option-backed Exit scalar", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const yieldDto = yieldApiYieldDtoFixture();
    const requiredYield = yieldApiYieldFixture({
      mechanics: {
        ...yieldDto.mechanics,
        arguments: {
          ...yieldDto.mechanics.arguments,
          exit: {
            fields: [
              {
                label: "Provider",
                name: "providerId",
                options: ["provider-a"],
                required: true,
                type: "string",
              },
              {
                label: "Resource",
                name: "tronResource",
                options: ["ENERGY"],
                required: true,
                type: "enum",
              },
              {
                label: "Validators",
                name: "validatorAddresses",
                required: true,
                type: "string",
              },
            ],
          },
        },
      },
    });
    const validatorBalance = Schema.decodeUnknownSync(EarnBalance)(
      yieldBalanceFixture({
        address,
        amount: "1",
        token: requiredYield.token,
        validators: [
          yieldApiValidatorFixture({
            address: "validator-a",
          }),
        ],
      })
    );
    const registry = makeRegistry({
      push,
      trackEvent,
      yieldBalance: validatorBalance,
      yieldOpportunity: requiredYield,
    });

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        pendingActions: new Map(),
        unstakeAmount: new BigNumber("0.4"),
        unstakeUseMaxAmount: false,
      });
      registry.set(submitPositionDetailsExitAtom(workflowKey), undefined);

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      expect(registry.get(currentClassicFlowSessionAtom)?.intake).toMatchObject(
        {
          _tag: "Exit",
          request: {
            arguments: {
              providerId: "provider-a",
              tronResource: "ENERGY",
              validatorAddresses: ["validator-a"],
            },
          },
        }
      );
    } finally {
      registry.dispose();
    }
  });

  it.each(["validatorAddress", "validatorAddresses"] as const)(
    "does not start Manage without required %s arguments",
    async (name) => {
      const push = vi.fn<(path: WidgetPath) => void>();
      const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
        () => Effect.void
      );
      const requiredManageBalance = Schema.decodeUnknownSync(EarnBalance)(
        yieldBalanceFixture({
          address,
          amount: "1",
          pendingActions: [
            {
              amount: "1",
              arguments: {
                fields: [
                  {
                    label: name,
                    name,
                    required: true,
                    type: "string",
                  },
                ],
              },
              intent: "manage",
              passthrough: "wallet-a-action",
              type: "CLAIM_REWARDS",
            },
          ],
          token: selectedYield.token,
        })
      );
      const requiredAction = requiredManageBalance.pendingActions[0]!;
      const registry = makeRegistry({ push, trackEvent });

      try {
        registry.set(openPositionPendingActionModalAtom(workflowKey), {
          pendingActionDto: requiredAction,
          yieldBalance: requiredManageBalance,
        });
        registry.set(runPositionPendingActionAtom(workflowKey), {
          _tag: "SubmitValidators",
        });
        await vi.waitFor(() =>
          expect(trackEvent).toHaveBeenCalledWith(
            "validatorsSubmitted",
            expect.anything()
          )
        );

        await Promise.resolve();

        expect(push).not.toHaveBeenCalled();
      } finally {
        registry.dispose();
      }
    }
  );

  it("closes only the validator modal attempt acknowledged by Started", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const validatorBalance = Schema.decodeUnknownSync(EarnBalance)(
      yieldBalanceFixture({
        address,
        amount: "1",
        pendingActions: [
          {
            amount: "1",
            arguments: {
              fields: [
                {
                  label: "Validators",
                  name: "validatorAddresses",
                  required: true,
                  type: "string",
                },
              ],
            },
            intent: "manage",
            passthrough: "wallet-a-action",
            type: "CLAIM_REWARDS",
          },
        ],
        token: selectedYield.token,
        validators: [yieldApiValidatorFixture({ address: "validator-a" })],
      })
    );
    const pendingActionDto = validatorBalance.pendingActions[0]!;
    const registry = makeRegistry({
      push,
      trackEvent,
      yieldBalance: validatorBalance,
    });
    const modalAtom = positionPendingActionModalViewAtom(workflowKey);
    const unmount = registry.mount(modalAtom);

    try {
      registry.set(openPositionPendingActionModalAtom(workflowKey), {
        pendingActionDto,
        yieldBalance: validatorBalance,
      });
      expect(registry.get(modalAtom)._tag).toBe("Open");

      registry.set(runPositionPendingActionAtom(workflowKey), {
        _tag: "SubmitValidators",
      });
      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      await vi.waitFor(() =>
        expect(registry.get(modalAtom)._tag).toBe("Closed")
      );

      registry.set(openPositionPendingActionModalAtom(workflowKey), {
        pendingActionDto,
        yieldBalance: validatorBalance,
      });
      expect(registry.get(modalAtom)._tag).toBe("Open");
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("sets the displayed maximum and tracks the user intent", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({ push, trackEvent });

    try {
      registry.set(setPositionDetailsExitMaxAmountAtom(workflowKey), undefined);

      await vi.waitFor(() => expect(trackEvent).toHaveBeenCalledOnce());
      expect(registry.get(positionDetailsWorkflowAtom(workflowKey))).toEqual({
        pendingActions: new Map(),
        unstakeAmount: new BigNumber(1),
        unstakeUseMaxAmount: true,
      });
      expect(trackEvent).toHaveBeenCalledWith("positionDetailsPageMaxClicked", {
        yieldId: selectedYield.id,
      });
      expect(push).not.toHaveBeenCalled();
    } finally {
      registry.dispose();
    }
  });

  it("rejects a stale Exit command after the Wallet Scope Owner changes", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({
      push,
      trackEvent,
      wallet: makeConnectedWallet({ address: otherAddress }),
    });

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        pendingActions: new Map(),
        unstakeAmount: new BigNumber("0.4"),
        unstakeUseMaxAmount: false,
      });
      registry.set(submitPositionDetailsExitAtom(workflowKey), undefined);

      await Promise.resolve();

      expect(push).not.toHaveBeenCalled();
      expect(
        registry.get(
          isActiveClassicTransactionFlowPathAtom(
            `/positions/${selectedYield.id}/balance-1/unstake/review`
          )
        )
      ).toBe(false);
    } finally {
      registry.dispose();
    }
  });

  it("rejects a stale Manage command after the Wallet Scope Owner changes", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({
      push,
      trackEvent,
      wallet: makeConnectedWallet({ address: otherAddress }),
    });

    try {
      registry.set(runPositionPendingActionAtom(workflowKey), {
        _tag: "Select",
        pendingActionDto: manageAction,
        yieldBalance: manageBalance,
      });

      await Promise.resolve();

      expect(push).not.toHaveBeenCalled();
      expect(
        registry.get(
          isActiveClassicTransactionFlowPathAtom(
            `/positions/${selectedYield.id}/balance-1/unstake/review`
          )
        )
      ).toBe(false);
    } finally {
      registry.dispose();
    }
  });

  it("starts Exit for a refreshed Wallet Scope with the same owner", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({
      push,
      trackEvent,
      wallet: makeConnectedWallet({
        additionalAddresses: { cosmosPubKey: "cosmos-refreshed" },
        address: sameAddressDifferentCase,
      }),
    });

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        pendingActions: new Map(),
        unstakeAmount: new BigNumber("0.4"),
        unstakeUseMaxAmount: false,
      });
      registry.set(submitPositionDetailsExitAtom(workflowKey), undefined);

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      expect(
        registry.get(
          isActiveClassicTransactionFlowPathAtom(
            `/positions/${selectedYield.id}/balance-1/unstake/review`
          )
        )
      ).toBe(true);
    } finally {
      registry.dispose();
    }
  });

  it("starts Manage for a refreshed Wallet Scope with the same owner", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const registry = makeRegistry({
      push,
      trackEvent,
      wallet: makeConnectedWallet({
        additionalAddresses: { cosmosPubKey: "cosmos-refreshed" },
        address: sameAddressDifferentCase,
      }),
    });

    try {
      registry.set(runPositionPendingActionAtom(workflowKey), {
        _tag: "Select",
        pendingActionDto: manageAction,
        yieldBalance: manageBalance,
      });

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      expect(
        registry.get(
          isActiveClassicTransactionFlowPathAtom(
            `/positions/${selectedYield.id}/balance-1/pending-action/review`
          )
        )
      ).toBe(true);
    } finally {
      registry.dispose();
    }
  });
});
