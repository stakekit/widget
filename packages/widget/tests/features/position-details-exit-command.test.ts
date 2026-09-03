import { describe, expect, it, vi } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { Deferred, Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { getPendingActionStateKey } from "../../src/domain/action/action-command";
import { EarnBalance } from "../../src/domain/earn/models";
import {
  TokenAddress,
  WalletAddress,
} from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import { isActiveClassicTransactionFlowPathAtom } from "../../src/features/classic-transaction-flow/index";
import { currentClassicFlowSessionAtom } from "../../src/features/classic-transaction-flow/state/atoms/classic-flow";
import { positionDetailsExitActions } from "../../src/features/position-details/state/classic-actions/exit";
import { positionDetailsPendingActions } from "../../src/features/position-details/state/classic-actions/pending-action";
import { positionDetailsClassicViewAtom } from "../../src/features/position-details/state/classic-facade";
import {
  PositionDetailsWorkflowKey,
  positionDetailsWorkflowAtom,
} from "../../src/features/position-details/state/workflow";
import { walletConnectionStateAtom } from "../../src/features/wallet/index";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../src/resources/yield-opportunity/provider";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../src/resources/yield-positions/yield-positions";
import {
  makeWidgetNavigation,
  type WidgetPath,
} from "../../src/services/navigation/widget-navigation";
import type { TrackingService } from "../../src/services/tracking/tracking-service";
import {
  disconnectedLedgerConnectorState,
  type NormalizedWalletState,
} from "../../src/services/wallet/wallet-state";
import {
  yieldApiValidatorFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../fixtures";
import { makeClassicFlowTestKit } from "../utils/classic-flow-test-kit";
import { makeTestTracking } from "../utils/services/tracking-service";
import { makeTestNavigation } from "../utils/services/widget-navigation";

const {
  setMaxAmount: setPositionDetailsExitMaxAmountAtom,
  setReceiveToken: setPositionDetailsExitReceiveTokenAtom,
  submit: submitPositionDetailsExitAtom,
} = positionDetailsExitActions;
const {
  modalView: positionPendingActionModalViewAtom,
  openModal: openPositionPendingActionModalAtom,
  run: runPositionPendingActionAtom,
} = positionDetailsPendingActions;

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x2234567890123456789012345678901234567890"
);
const sameAddressDifferentCase = Schema.decodeSync(WalletAddress)(
  address.toUpperCase()
);
const usdsAddress = Schema.decodeSync(TokenAddress)(
  "0xdC035D45d973E3EC169d2276DDab16f1e407384F"
);
const usdcAddress = Schema.decodeSync(TokenAddress)(
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
);
const scope = new WalletScopeKey({ address, network: "ethereum" });
const skyYieldDto = yieldApiYieldDtoFixture();
const usdsToken = {
  ...skyYieldDto.token,
  address: usdsAddress,
  name: "USDS",
  symbol: "USDS",
};
const usdcToken = {
  ...skyYieldDto.token,
  address: usdcAddress,
  name: "USD Coin",
  symbol: "USDC",
};
const susdsToken = {
  ...skyYieldDto.token,
  address: "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD",
  name: "Savings USDS",
  symbol: "sUSDS",
};
const skySavingsRateFields = {
  inputTokens: [usdsToken, usdcToken],
  outputToken: susdsToken,
  providerId: "sky",
  token: usdsToken,
  tokens: [usdsToken],
} as const;
const baseYield = yieldApiYieldFixture();
const selectedYield = yieldApiYieldFixture({
  ...skySavingsRateFields,
  id: "ethereum-usds-susds-0xa3931d71877c0e7a3148cb7eb4463524fec27fbd-4626-vault",
  metadata: {
    ...baseYield.metadata,
    supportedStandards: ["ERC4626"],
  },
});
const balance = Schema.decodeSync(EarnBalance)(
  yieldBalanceFixture({
    address,
    amount: "1",
    token: selectedYield.token,
  })
);
const manageBalance = Schema.decodeSync(EarnBalance)(
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
  readonly yieldBalance?: EarnBalance;
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
        Layer.unwrap(
          Effect.all({
            navigation: makeTestNavigation({ execute: navigation.execute }),
            tracking: makeTestTracking({ trackEvent }),
          }).pipe(
            Effect.map(({ navigation: testNavigation, tracking }) =>
              Layer.merge(testNavigation.layer, tracking.layer)
            )
          )
        ) as never
      ),
      Atom.initialValue(
        walletRuntime.layer,
        Layer.unwrap(
          makeClassicFlowTestKit({
            initialWalletState: walletState,
            navigation: { execute: navigation.execute },
          }).pipe(Effect.map((kit) => kit.layer))
        ) as never
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
  it("keeps an untouched exit amount neutral until submission", async () => {
    const yieldDto = yieldApiYieldDtoFixture();
    const constrainedYield = yieldApiYieldFixture({
      ...skySavingsRateFields,
      id: selectedYield.id,
      mechanics: {
        ...yieldDto.mechanics,
        arguments: {
          ...yieldDto.mechanics.arguments,
          exit: {
            fields: [
              {
                label: "Amount",
                maximum: "10",
                minimum: "1",
                name: "amount",
                required: true,
                type: "string",
              },
            ],
          },
        },
      },
    });
    const registry = makeRegistry({
      push: vi.fn(),
      trackEvent: () => Effect.void,
      yieldOpportunity: constrainedYield,
    });
    const commandAtom = submitPositionDetailsExitAtom(workflowKey);
    const viewAtom = positionDetailsClassicViewAtom(workflowKey);
    const unmountView = registry.mount(viewAtom);

    try {
      expect(registry.get(viewAtom)).toMatchObject({
        unstakeAmountError: false,
        unstakeIsGreaterOrLessIntegrationLimitError: false,
      });

      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        exitReceiveTokenAddress: null,
        pendingActions: new Map(),
        unstakeAmount: new BigNumber("0.5"),
        unstakeUseMaxAmount: false,
      });
      expect(registry.get(viewAtom)).toMatchObject({
        unstakeAmountError: true,
        unstakeIsGreaterOrLessIntegrationLimitError: true,
      });

      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        exitReceiveTokenAddress: null,
        pendingActions: new Map(),
        unstakeAmount: new BigNumber(0),
        unstakeUseMaxAmount: false,
      });
      expect(registry.get(viewAtom)).toMatchObject({
        unstakeAmountError: false,
        unstakeIsGreaterOrLessIntegrationLimitError: false,
      });

      registry.set(commandAtom, undefined);

      await vi.waitFor(() =>
        expect(AsyncResult.isSuccess(registry.get(commandAtom))).toBe(true)
      );
      expect(AsyncResult.getOrThrow(registry.get(commandAtom))).toEqual({
        _tag: "Invalid",
      });
      expect(registry.get(viewAtom)).toMatchObject({
        unstakeAmountError: true,
        unstakeIsGreaterOrLessIntegrationLimitError: true,
      });
    } finally {
      unmountView();
      registry.dispose();
    }
  });

  it.each([
    {
      expectedAddress: usdsAddress,
      expectedSymbol: "USDS",
      name: "default USDS",
      selectedAddress: null,
    },
    {
      expectedAddress: usdcAddress,
      expectedSymbol: "USDC",
      name: "selected USDC",
      selectedAddress: usdcAddress,
    },
  ] as const)(
    "hands the $name Exit Receive Token to Classic Flow",
    async ({ expectedAddress, expectedSymbol, selectedAddress }) => {
      const push = vi.fn<(path: WidgetPath) => void>();
      const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
        () => Effect.void
      );
      const yieldDto = yieldApiYieldDtoFixture();
      const eligibleYield = yieldApiYieldFixture({
        ...skySavingsRateFields,
        id: selectedYield.id,
        metadata: selectedYield.metadata,
        mechanics: {
          ...yieldDto.mechanics,
          arguments: {
            ...yieldDto.mechanics.arguments,
            exit: {
              fields: [
                {
                  label: "Output Token",
                  name: "outputToken",
                  options: [
                    "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
                    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                  ],
                  required: false,
                  type: "string",
                },
              ],
            },
          },
        },
      });
      const registry = makeRegistry({
        push,
        trackEvent,
        yieldOpportunity: eligibleYield,
      });
      const commandAtom = submitPositionDetailsExitAtom(workflowKey);
      const viewAtom = positionDetailsClassicViewAtom(workflowKey);
      const unmountView = registry.mount(viewAtom);

      try {
        registry.set(positionDetailsWorkflowAtom(workflowKey), {
          exitReceiveTokenAddress: null,
          pendingActions: new Map(),
          unstakeAmount: new BigNumber("0.4"),
          unstakeUseMaxAmount: false,
        });
        if (selectedAddress) {
          registry.set(
            setPositionDetailsExitReceiveTokenAtom(workflowKey),
            selectedAddress
          );
        }
        expect(registry.get(viewAtom)).toMatchObject({
          exitReceiveTokenSelection: {
            selected: { address: expectedAddress, symbol: expectedSymbol },
          },
          integrationData: { id: selectedYield.id },
        });
        registry.set(commandAtom, undefined);

        await vi.waitFor(() =>
          expect(AsyncResult.isSuccess(registry.get(commandAtom))).toBe(true)
        );
        expect(AsyncResult.getOrThrow(registry.get(commandAtom))).toEqual({
          _tag: "Started",
        });
        expect(push).toHaveBeenCalledOnce();
        expect(
          registry.get(currentClassicFlowSessionAtom)?.intake
        ).toMatchObject({
          _tag: "Exit",
          receiveToken: { address: expectedAddress, symbol: expectedSymbol },
          request: { arguments: { outputToken: expectedAddress } },
        });
      } finally {
        unmountView();
        registry.dispose();
      }
    }
  );

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
        exitReceiveTokenAddress: null,
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
        pendingAction: manageAction,
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

  it("rejects a Pending Action that disappeared from current balances", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const registry = makeRegistry({
      push,
      trackEvent: () => Effect.void,
    });

    try {
      registry.set(runPositionPendingActionAtom(workflowKey), {
        _tag: "Select",
        pendingAction: manageAction,
        yieldBalance: manageBalance,
      });

      await Promise.resolve();
      expect(push).not.toHaveBeenCalled();
    } finally {
      registry.dispose();
    }
  });

  it("rejects a Pending Action amount invalidated by current constraints", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const constrainedBalance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        address,
        amount: "10",
        pendingActions: [
          {
            amount: "10",
            arguments: {
              fields: [
                {
                  label: "Amount",
                  maximum: "10",
                  minimum: "5",
                  name: "amount",
                  required: true,
                  type: "string",
                },
              ],
            },
            intent: "manage",
            passthrough: "constrained-action",
            type: "CLAIM_REWARDS",
          },
        ],
        token: selectedYield.token,
      })
    );
    const constrainedAction = constrainedBalance.pendingActions[0]!;
    const constrainedKey = getPendingActionStateKey({
      actionType: constrainedAction.type,
      balanceType: constrainedBalance.type,
      passthrough: constrainedAction.passthrough,
      token: constrainedBalance.token,
    });
    const registry = makeRegistry({
      push,
      trackEvent: () => Effect.void,
      yieldBalance: constrainedBalance,
    });

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        exitReceiveTokenAddress: null,
        pendingActions: new Map([[constrainedKey, new BigNumber(4)]]),
        unstakeAmount: new BigNumber(0),
        unstakeUseMaxAmount: false,
      });
      registry.set(runPositionPendingActionAtom(workflowKey), {
        _tag: "Select",
        pendingAction: constrainedAction,
        yieldBalance: constrainedBalance,
      });

      await Promise.resolve();
      expect(push).not.toHaveBeenCalled();
    } finally {
      registry.dispose();
    }
  });

  it.effect("does not order Pending Action start behind telemetry", () =>
    Effect.gen(function* () {
      const push = vi.fn<(path: WidgetPath) => void>();
      const trackingRelease = yield* Deferred.make<void>();
      const registry = makeRegistry({
        push,
        trackEvent: () => Deferred.await(trackingRelease),
        yieldBalance: manageBalance,
      });
      const commandAtom = runPositionPendingActionAtom(workflowKey);

      try {
        registry.set(commandAtom, {
          _tag: "Select",
          pendingAction: manageAction,
          yieldBalance: manageBalance,
        });

        yield* Effect.promise(() =>
          vi.waitFor(() => expect(push).toHaveBeenCalledOnce())
        );
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(AsyncResult.isSuccess(registry.get(commandAtom))).toBe(true)
          )
        );
        expect(AsyncResult.getOrThrow(registry.get(commandAtom))).toMatchObject(
          {
            _tag: "Started",
          }
        );
        yield* Deferred.succeed(trackingRelease, undefined);
      } finally {
        registry.dispose();
      }
    })
  );

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
          exitReceiveTokenAddress: null,
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
        exitReceiveTokenAddress: null,
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
      const intake = registry.get(currentClassicFlowSessionAtom)?.intake;
      expect(intake).toMatchObject({ _tag: "Exit", receiveToken: null });
      if (intake?._tag !== "Exit") {
        throw new Error("Expected an active Exit intake");
      }
      expect(intake.request.arguments).not.toHaveProperty("outputToken");
    } finally {
      registry.dispose();
    }
  });

  it("forwards the receive token without enforcing an option count", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const yieldDto = yieldApiYieldDtoFixture();
    const incompleteCapabilityYield = yieldApiYieldFixture({
      ...skySavingsRateFields,
      id: selectedYield.id,
      mechanics: {
        ...yieldDto.mechanics,
        arguments: {
          ...yieldDto.mechanics.arguments,
          exit: {
            fields: [
              {
                label: "Output Token",
                name: "outputToken",
                options: ["0xdC035D45d973E3EC169d2276DDab16f1e407384F"],
                required: true,
                type: "string",
              },
            ],
          },
        },
      },
    });
    const registry = makeRegistry({
      push,
      trackEvent,
      yieldOpportunity: incompleteCapabilityYield,
    });

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        exitReceiveTokenAddress: null,
        pendingActions: new Map(),
        unstakeAmount: new BigNumber("0.4"),
        unstakeUseMaxAmount: false,
      });
      registry.set(submitPositionDetailsExitAtom(workflowKey), undefined);

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      const intake = registry.get(currentClassicFlowSessionAtom)?.intake;
      expect(intake).toMatchObject({
        _tag: "Exit",
        receiveToken: { address: usdsAddress, symbol: "USDS" },
      });
      if (intake?._tag !== "Exit") {
        throw new Error("Expected an active Exit intake");
      }
      expect(intake.request.arguments).toHaveProperty(
        "outputToken",
        usdsAddress
      );
    } finally {
      registry.dispose();
    }
  });

  it("marks an untouched forced full-balance Exit as useMaxAmount", async () => {
    const push = vi.fn<(path: WidgetPath) => void>();
    const trackEvent = vi.fn<TrackingService["Service"]["trackEvent"]>(
      () => Effect.void
    );
    const yieldDto = yieldApiYieldDtoFixture();
    const forceMaxYield = yieldApiYieldFixture({
      mechanics: {
        ...yieldDto.mechanics,
        arguments: {
          ...yieldDto.mechanics.arguments,
          exit: {
            fields: [
              {
                label: "Amount",
                maximum: "-1",
                minimum: "-1",
                name: "amount",
                required: true,
                type: "string",
              },
            ],
          },
        },
      },
    });
    const registry = makeRegistry({
      push,
      trackEvent,
      yieldOpportunity: forceMaxYield,
    });

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        exitReceiveTokenAddress: null,
        pendingActions: new Map(),
        unstakeAmount: new BigNumber(0),
        unstakeUseMaxAmount: false,
      });
      registry.set(submitPositionDetailsExitAtom(workflowKey), undefined);

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      expect(registry.get(currentClassicFlowSessionAtom)?.intake).toMatchObject(
        {
          _tag: "Exit",
          request: {
            arguments: {
              amount: "1",
              useMaxAmount: true,
            },
          },
          unstakeAmount: new BigNumber(1),
        }
      );
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
    const validatorBalance = Schema.decodeSync(EarnBalance)(
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
        exitReceiveTokenAddress: null,
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
      const requiredManageBalance = Schema.decodeSync(EarnBalance)(
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
      const registry = makeRegistry({
        push,
        trackEvent,
        yieldBalance: requiredManageBalance,
      });

      try {
        registry.set(openPositionPendingActionModalAtom(workflowKey), {
          pendingAction: requiredAction,
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
    const validatorBalance = Schema.decodeSync(EarnBalance)(
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
    const pendingAction = validatorBalance.pendingActions[0]!;
    const registry = makeRegistry({
      push,
      trackEvent,
      yieldBalance: validatorBalance,
    });
    const modalAtom = positionPendingActionModalViewAtom(workflowKey);
    const unmount = registry.mount(modalAtom);

    try {
      registry.set(openPositionPendingActionModalAtom(workflowKey), {
        pendingAction,
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
        pendingAction,
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
        exitReceiveTokenAddress: null,
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

  it("keeps semantic Exit Max bound to the latest live maximum", async () => {
    const refreshedBalance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        address,
        amount: "0.75",
        token: selectedYield.token,
      })
    );
    const registry = makeRegistry({
      push: vi.fn(),
      trackEvent: () => Effect.void,
      yieldBalance: refreshedBalance,
    });
    const viewAtom = positionDetailsClassicViewAtom(workflowKey);
    const unmount = registry.mount(viewAtom);

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        exitReceiveTokenAddress: null,
        pendingActions: new Map(),
        unstakeAmount: new BigNumber(1),
        unstakeUseMaxAmount: true,
      });

      expect(registry.get(viewAtom).unstakeAmount.toString()).toBe("0.75");
      expect(
        registry.get(positionDetailsWorkflowAtom(workflowKey))
          .unstakeUseMaxAmount
      ).toBe(true);
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("formats a partial Exit from the entered amount", () => {
    const yieldDto = yieldApiYieldDtoFixture();
    const partialExitYield = yieldApiYieldFixture({
      ...skySavingsRateFields,
      id: selectedYield.id,
      metadata: selectedYield.metadata,
      mechanics: {
        ...yieldDto.mechanics,
        arguments: {
          ...yieldDto.mechanics.arguments,
          exit: {
            fields: [
              {
                label: "Amount",
                maximum: "2",
                minimum: "0",
                name: "amount",
                required: true,
                type: "string",
              },
            ],
          },
        },
      },
    });
    const partialBalance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        amount: "2",
        amountUsd: "10",
        token: partialExitYield.token,
      })
    );
    const registry = makeRegistry({
      push: vi.fn(),
      trackEvent: () => Effect.void,
      yieldBalance: partialBalance,
      yieldOpportunity: partialExitYield,
    });
    const viewAtom = positionDetailsClassicViewAtom(workflowKey);
    const unmountView = registry.mount(viewAtom);

    try {
      registry.set(positionDetailsWorkflowAtom(workflowKey), {
        exitReceiveTokenAddress: null,
        pendingActions: new Map(),
        unstakeAmount: new BigNumber("0.5"),
        unstakeUseMaxAmount: false,
      });

      expect(registry.get(viewAtom)).toMatchObject({
        unstakeAmount: new BigNumber("0.5"),
        unstakeFormattedAmount: "$2.50",
      });
    } finally {
      unmountView();
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
        exitReceiveTokenAddress: null,
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
        pendingAction: manageAction,
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
        exitReceiveTokenAddress: null,
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
      yieldBalance: manageBalance,
    });

    try {
      registry.set(runPositionPendingActionAtom(workflowKey), {
        _tag: "Select",
        pendingAction: manageAction,
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
