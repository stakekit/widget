import { Cause, Effect, Layer, Option, Schema, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { widgetConfigAtom } from "../../src/app/config/settings";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { PositionsData } from "../../src/domain/types/positions";
import { tokenString } from "../../src/domain/types/tokens";
import {
  earnYieldCatalogAtom,
  initYieldAtom,
  mergedTokenOptionsAtom,
  positionsDataAtom,
} from "../../src/features/earn/state/atoms-state/catalog/atoms";
import {
  InitYieldKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
} from "../../src/features/earn/state/atoms-state/catalog/keys";
import {
  earnMachineEntryAtom,
  earnMachineIntentAtom,
  earnMachineViewAtom,
} from "../../src/features/earn/state/atoms-state/machine/atoms";
import { makeResolvingWalletView } from "../../src/features/earn/state/atoms-state/resolver/view-model";
import {
  EarnCatalogError,
  type EarnTokenOption,
} from "../../src/features/earn/state/atoms-state/types";
import {
  earnPageInputAtom,
  earnPageQuoteAtom,
  earnPageSearchAtom,
  earnPageSelectionAtom,
  earnPageSubmittedAtom,
} from "../../src/features/earn/state/page-workflow";
import { initParamsAtom } from "../../src/features/init-params/state";
import { walletStateResultAtom } from "../../src/features/wallet/state";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/domain/state";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../fixtures";

const baseDto = yieldApiYieldDtoFixture();
const firstYield = yieldApiYieldFixture();
const secondYield = yieldApiYieldFixture({
  id: "ethereum-usdc-lending",
  token: {
    ...baseDto.token,
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    name: "USD Coin",
    symbol: "USDC",
  },
});

const toTokenOption = (yieldModel: typeof firstYield): EarnTokenOption => ({
  amount: "10",
  availableYields: [yieldModel.id],
  source: "balance",
  token: yieldModel.token,
});

const firstOwnerAddress = Schema.decodeSync(WalletAddress)(
  "0x1111111111111111111111111111111111111111"
);
const firstOwnerScope = new WalletScopeKey({
  address: firstOwnerAddress,
  network: "ethereum",
});
const secondOwnerAddress = Schema.decodeSync(WalletAddress)(
  "0x2222222222222222222222222222222222222222"
);
const secondOwnerScope = new WalletScopeKey({
  address: secondOwnerAddress,
  network: "ethereum",
});
const connectedWalletState: NormalizedWalletState = {
  additionalAddresses: null,
  address: firstOwnerAddress,
  chain: {} as never,
  connector: {} as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
};
const secondConnectedWalletState: NormalizedWalletState = {
  ...connectedWalletState,
  address: secondOwnerAddress,
};

const makeWalletState = (connection: NormalizedWalletState): WalletState => ({
  connection,
  ledger: disconnectedLedgerConnectorState,
});

/**
 * Seeds every resource `resolveEarnView` reads so the published view reaches
 * `ready` without a network, which is the only status where the removed
 * write-back used to fire.
 */
const makeReadyRegistry = () => {
  const tokenOptions = [toTokenOption(firstYield), toTokenOption(secondYield)];

  return AtomRegistry.make({
    initialValues: [
      [
        walletStateResultAtom,
        AsyncResult.success(disconnectedNormalizedWalletState),
      ],
      [
        initYieldAtom(new InitYieldKey({ yieldId: null })),
        AsyncResult.success(null),
      ],
      [
        mergedTokenOptionsAtom(
          new TokenOptionsKey({
            category: null,
            initToken: null,
            initTokenNetwork: null,
            initYieldId: null,
            scope: null,
            tokensForEnabledYieldsOnly: false,
          })
        ),
        AsyncResult.success(tokenOptions),
      ],
      [
        positionsDataAtom(new PositionsDataKey({ scope: null })),
        AsyncResult.success(new Map() as PositionsData),
      ],
      ...[firstYield, secondYield].map(
        (yieldModel) =>
          [
            earnYieldCatalogAtom(
              new YieldCatalogKey({
                category: null,
                network: yieldModel.token.network,
                yieldIds: [yieldModel.id],
              })
            ),
            AsyncResult.success([yieldModel]),
          ] as const
      ),
    ],
  });
};

describe("earn page workflow atoms", () => {
  it("waits for Wallet Bootstrap before resolving Earn Initialization", () => {
    const registry = AtomRegistry.make({
      initialValues: [[walletStateResultAtom, AsyncResult.initial(true)]],
    });

    expect(registry.get(earnMachineEntryAtom).walletResolution).toBe("pending");
    registry.dispose();
  });

  it("treats a failed Wallet Bootstrap attempt as settled", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        [
          walletStateResultAtom,
          AsyncResult.failure(Cause.fail(new Error("wallet bootstrap failed"))),
        ],
      ],
    });

    expect(registry.get(earnMachineEntryAtom).walletResolution).toBe("settled");
    registry.dispose();
  });

  it("captures the owner atomically when the initial wallet connects", async () => {
    const walletState = Effect.runSync(
      SubscriptionRef.make<WalletState>({
        ...makeWalletState(disconnectedNormalizedWalletState),
        connection: {
          ...disconnectedNormalizedWalletState,
          status: "connecting",
        },
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        [
          walletRuntime.layer,
          Layer.succeed(
            WalletService,
            WalletService.of({
              state: SubscriptionRef.get(walletState),
              states: SubscriptionRef.changes(walletState),
              wagmiConfig: {} as never,
            } as never)
          ) as never,
        ],
      ],
    });
    const unmount = registry.mount(earnMachineEntryAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(earnMachineEntryAtom).walletResolution).toBe(
          "pending"
        )
      );

      Effect.runSync(
        SubscriptionRef.set(walletState, makeWalletState(connectedWalletState))
      );

      await vi.waitFor(() =>
        expect(registry.get(earnMachineEntryAtom)).toMatchObject({
          walletResolution: "settled",
          walletScope: firstOwnerScope,
        })
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("does not reapply startup initialization after a later manual connection", async () => {
    const walletState = Effect.runSync(
      SubscriptionRef.make(makeWalletState(disconnectedNormalizedWalletState))
    );
    const tokenOptions = [
      toTokenOption(firstYield),
      toTokenOption(secondYield),
    ];
    const initParams = {
      accountId: "ledger-account",
      balanceId: null,
      network: null,
      pendingaction: null,
      tab: null,
      token: null,
      validator: null,
      yieldId: secondYield.id,
    } as const;
    const registry = AtomRegistry.make({
      initialValues: [
        [
          walletRuntime.layer,
          Layer.succeed(
            WalletService,
            WalletService.of({
              state: SubscriptionRef.get(walletState),
              states: SubscriptionRef.changes(walletState),
              wagmiConfig: {} as never,
            } as never)
          ) as never,
        ],
        [initParamsAtom, initParams],
        [
          initYieldAtom(new InitYieldKey({ yieldId: secondYield.id })),
          AsyncResult.success(secondYield),
        ],
        [
          initYieldAtom(new InitYieldKey({ yieldId: null })),
          AsyncResult.success(null),
        ],
        ...[null, firstOwnerScope].flatMap((scope) => [
          [
            positionsDataAtom(new PositionsDataKey({ scope })),
            AsyncResult.success(new Map() as PositionsData),
          ] as const,
          [
            mergedTokenOptionsAtom(
              new TokenOptionsKey({
                category: null,
                initToken: null,
                initTokenNetwork: null,
                initYieldId: secondYield.id,
                scope,
                tokensForEnabledYieldsOnly: false,
              })
            ),
            AsyncResult.success(tokenOptions),
          ] as const,
          [
            mergedTokenOptionsAtom(
              new TokenOptionsKey({
                category: null,
                initToken: null,
                initTokenNetwork: null,
                initYieldId: null,
                scope,
                tokensForEnabledYieldsOnly: false,
              })
            ),
            AsyncResult.success(tokenOptions),
          ] as const,
        ]),
        ...[firstYield, secondYield].map(
          (yieldModel) =>
            [
              earnYieldCatalogAtom(
                new YieldCatalogKey({
                  category: null,
                  network: yieldModel.token.network,
                  yieldIds: [yieldModel.id],
                })
              ),
              AsyncResult.success([yieldModel]),
            ] as const
        ),
      ],
    });
    const unmount = registry.mount(earnMachineViewAtom);

    try {
      await vi.waitFor(() => {
        expect(registry.get(earnMachineViewAtom).selection.yield).toEqual(
          secondYield
        );
      });

      Effect.runSync(
        SubscriptionRef.set(walletState, makeWalletState(connectedWalletState))
      );

      await vi.waitFor(() => {
        const view = registry.get(earnMachineViewAtom);

        expect(view.status).toBe("ready");
        expect(view.selection.yield).toEqual(firstYield);
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("keeps initialization active after a command while explicit intent wins", () => {
    const tokenOptions = [
      toTokenOption(firstYield),
      toTokenOption(secondYield),
    ];
    const registry = AtomRegistry.make({
      initialValues: [
        [
          walletStateResultAtom,
          AsyncResult.success(disconnectedNormalizedWalletState),
        ],
        [
          initParamsAtom,
          {
            accountId: null,
            balanceId: null,
            network: null,
            pendingaction: null,
            tab: null,
            token: null,
            validator: null,
            yieldId: secondYield.id,
          },
        ],
        ...[firstYield, secondYield].map(
          (yieldModel) =>
            [
              initYieldAtom(new InitYieldKey({ yieldId: yieldModel.id })),
              AsyncResult.success(yieldModel),
            ] as const
        ),
        [
          positionsDataAtom(new PositionsDataKey({ scope: null })),
          AsyncResult.success(new Map() as PositionsData),
        ],
        [
          mergedTokenOptionsAtom(
            new TokenOptionsKey({
              category: null,
              initToken: null,
              initTokenNetwork: null,
              initYieldId: secondYield.id,
              scope: null,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          AsyncResult.initial(true),
        ],
        ...[null, firstYield.id].map(
          (initYieldId) =>
            [
              mergedTokenOptionsAtom(
                new TokenOptionsKey({
                  category: null,
                  initToken: null,
                  initTokenNetwork: null,
                  initYieldId,
                  scope: null,
                  tokensForEnabledYieldsOnly: false,
                })
              ),
              AsyncResult.success(tokenOptions),
            ] as const
        ),
        [
          earnYieldCatalogAtom(
            new YieldCatalogKey({
              category: null,
              network: firstYield.token.network,
              yieldIds: [firstYield.id],
            })
          ),
          AsyncResult.success([firstYield]),
        ],
      ],
    });
    const unmount = registry.mount(earnMachineViewAtom);

    expect(registry.get(earnMachineViewAtom).status).toBe(
      "loading-initial-selection"
    );

    registry.set(earnMachineIntentAtom, {
      type: "stakeAmount/change",
      amount: "1",
    });

    expect(registry.get(earnMachineViewAtom)).toMatchObject({
      form: { stakeAmount: "1" },
      status: "loading-initial-selection",
    });

    registry.set(earnMachineIntentAtom, {
      type: "yield/select",
      yieldId: firstYield.id,
    });

    expect(registry.get(earnMachineIntentAtom).selectedYieldId).toBe(
      firstYield.id
    );
    expect(registry.get(earnMachineViewAtom).status).not.toBe(
      "loading-initial-selection"
    );
    unmount();
    registry.dispose();
  });

  it("abandons pending initialization when the initial owner changes", async () => {
    const walletState = Effect.runSync(
      SubscriptionRef.make(makeWalletState(connectedWalletState))
    );
    const tokenOptions = [
      toTokenOption(firstYield),
      toTokenOption(secondYield),
    ];
    const registry = AtomRegistry.make({
      initialValues: [
        [
          walletRuntime.layer,
          Layer.succeed(
            WalletService,
            WalletService.of({
              state: SubscriptionRef.get(walletState),
              states: SubscriptionRef.changes(walletState),
              wagmiConfig: {} as never,
            } as never)
          ) as never,
        ],
        [
          initParamsAtom,
          {
            accountId: null,
            balanceId: null,
            network: null,
            pendingaction: null,
            tab: null,
            token: null,
            validator: null,
            yieldId: secondYield.id,
          },
        ],
        [
          initYieldAtom(new InitYieldKey({ yieldId: secondYield.id })),
          AsyncResult.success(secondYield),
        ],
        [
          initYieldAtom(new InitYieldKey({ yieldId: null })),
          AsyncResult.success(null),
        ],
        ...[firstOwnerScope, secondOwnerScope].map(
          (scope) =>
            [
              positionsDataAtom(new PositionsDataKey({ scope })),
              AsyncResult.success(new Map() as PositionsData),
            ] as const
        ),
        [
          mergedTokenOptionsAtom(
            new TokenOptionsKey({
              category: null,
              initToken: null,
              initTokenNetwork: null,
              initYieldId: secondYield.id,
              scope: firstOwnerScope,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          AsyncResult.initial(true),
        ],
        [
          mergedTokenOptionsAtom(
            new TokenOptionsKey({
              category: null,
              initToken: null,
              initTokenNetwork: null,
              initYieldId: null,
              scope: secondOwnerScope,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          AsyncResult.success(tokenOptions),
        ],
        ...[firstYield, secondYield].map(
          (yieldModel) =>
            [
              earnYieldCatalogAtom(
                new YieldCatalogKey({
                  category: null,
                  network: yieldModel.token.network,
                  yieldIds: [yieldModel.id],
                })
              ),
              AsyncResult.success([yieldModel]),
            ] as const
        ),
      ],
    });
    const unmount = registry.mount(earnMachineViewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(earnMachineViewAtom).status).toBe(
          "loading-initial-selection"
        )
      );

      Effect.runSync(
        SubscriptionRef.set(
          walletState,
          makeWalletState(secondConnectedWalletState)
        )
      );

      await vi.waitFor(() => {
        const view = registry.get(earnMachineViewAtom);

        expect(view.status).toBe("ready");
        expect(view.selection.yield).toEqual(firstYield);
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("consumes initialization after an initialization resource fails", () => {
    const tokenOptions = [
      toTokenOption(firstYield),
      toTokenOption(secondYield),
    ];
    const registry = AtomRegistry.make({
      initialValues: [
        [
          walletStateResultAtom,
          AsyncResult.success(disconnectedNormalizedWalletState),
        ],
        [
          initParamsAtom,
          {
            accountId: null,
            balanceId: null,
            network: null,
            pendingaction: null,
            tab: null,
            token: null,
            validator: null,
            yieldId: secondYield.id,
          },
        ],
        [
          initYieldAtom(new InitYieldKey({ yieldId: secondYield.id })),
          AsyncResult.failure(
            Cause.fail(new Error("initial yield request failed"))
          ),
        ],
        [
          initYieldAtom(new InitYieldKey({ yieldId: null })),
          AsyncResult.success(null),
        ],
        [
          positionsDataAtom(new PositionsDataKey({ scope: null })),
          AsyncResult.success(new Map() as PositionsData),
        ],
        [
          mergedTokenOptionsAtom(
            new TokenOptionsKey({
              category: null,
              initToken: null,
              initTokenNetwork: null,
              initYieldId: secondYield.id,
              scope: null,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          AsyncResult.failure(
            Cause.fail(
              new EarnCatalogError({
                cause: new Error("initial yield request failed"),
                operation: "init-yield",
              })
            )
          ),
        ],
        [
          mergedTokenOptionsAtom(
            new TokenOptionsKey({
              category: null,
              initToken: null,
              initTokenNetwork: null,
              initYieldId: null,
              scope: null,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          AsyncResult.success(tokenOptions),
        ],
        [
          earnYieldCatalogAtom(
            new YieldCatalogKey({
              category: null,
              network: firstYield.token.network,
              yieldIds: [firstYield.id],
            })
          ),
          AsyncResult.success([firstYield]),
        ],
      ],
    });

    expect(registry.get(earnMachineViewAtom).status).toBe("failed");

    registry.set(earnMachineIntentAtom, {
      type: "stakeAmount/change",
      amount: "1",
    });

    const view = registry.get(earnMachineViewAtom);
    expect(view.status).toBe("ready");
    expect(view.selection.yield).toEqual(firstYield);
    registry.dispose();
  });

  it("derives input, selection, and quote models from the feature machine", () => {
    const registry = AtomRegistry.make();

    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("0");
    expect(registry.get(earnPageSelectionAtom).yield).toBeNull();
    expect(registry.get(earnPageQuoteAtom).stakeAmount.toFixed()).toBe("0");
    registry.dispose();
  });

  it("preserves machine intent when runtime inputs change", () => {
    const registry = AtomRegistry.make();

    expect(registry.get(earnMachineEntryAtom).tokensForEnabledYieldsOnly).toBe(
      false
    );
    registry.set(earnMachineIntentAtom, {
      type: "category/select",
      category: "defi",
    });
    registry.set(widgetConfigAtom, {
      ...registry.get(widgetConfigAtom),
      tokensForEnabledYieldsOnly: true,
    });

    expect(registry.get(earnMachineEntryAtom).tokensForEnabledYieldsOnly).toBe(
      true
    );
    expect(registry.get(earnMachineIntentAtom).selectedCategory).toBe("defi");
    registry.dispose();
  });

  it("publishes resolving-wallet while retaining the selection snapshot", () => {
    const registry = makeReadyRegistry();
    const previousView = registry.get(earnMachineViewAtom);

    expect(previousView.status).toBe("ready");
    expect(
      makeResolvingWalletView({
        intent: registry.get(earnMachineIntentAtom),
        previous: Option.some(previousView),
      })
    ).toMatchObject({
      can: {
        selectToken: false,
        selectValidator: false,
        selectYield: false,
        submit: false,
      },
      selection: previousView.selection,
      status: "resolving-wallet",
    });
    registry.dispose();
  });

  it("keeps publishing view updates after a command when the first read has no listener", () => {
    const registry = makeReadyRegistry();

    // useSyncExternalStore reads a snapshot during render and only subscribes on
    // commit, so the machine view is first built with no listener attached.
    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("0");
    expect(registry.get(earnMachineViewAtom).status).toBe("ready");
    registry.subscribe(earnPageInputAtom, () => {}, { immediate: false });

    registry.set(earnMachineIntentAtom, {
      type: "stakeAmount/change",
      amount: "5",
    });
    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("5");

    registry.set(earnMachineIntentAtom, {
      type: "stakeAmount/change",
      amount: "7",
    });
    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("7");
    registry.dispose();
  });

  it("derives the published view without writing back into machine state", () => {
    const registry = makeReadyRegistry();
    const intentBefore = registry.get(earnMachineIntentAtom);

    // The resolver fills the selection from defaults the intent never named.
    expect(registry.get(earnMachineViewAtom).selection.yield).toEqual(
      firstYield
    );
    expect(intentBefore.selectedYieldId).toBeNull();
    expect(registry.get(earnMachineIntentAtom)).toBe(intentBefore);
    registry.dispose();
  });

  it("owns searches and submission state", () => {
    const registry = AtomRegistry.make();

    registry.set(earnPageSearchAtom, {
      stake: "ethereum",
      token: "eth",
      validator: "validator",
    });
    registry.set(earnPageSubmittedAtom, true);

    expect(registry.get(earnPageSearchAtom).token).toBe("eth");
    expect(registry.get(earnPageSubmittedAtom)).toBe(true);
    registry.dispose();
  });

  it("resets submission state when the resolved selection changes", () => {
    const registry = makeReadyRegistry();

    expect(registry.get(earnMachineViewAtom).selection.token?.token).toEqual(
      firstYield.token
    );

    registry.set(earnPageSubmittedAtom, true);
    registry.set(earnMachineIntentAtom, {
      type: "token/select",
      tokenKey: tokenString(secondYield.token),
    });
    expect(registry.get(earnMachineViewAtom).selection.yield).toEqual(
      secondYield
    );
    expect(registry.get(earnPageSubmittedAtom)).toBe(false);

    registry.set(earnPageSubmittedAtom, true);
    registry.set(earnMachineIntentAtom, {
      type: "stakeAmount/change",
      amount: "1",
    });
    expect(registry.get(earnPageSubmittedAtom)).toBe(true);
    registry.dispose();
  });
});
