import { Cause, Effect, Layer, Schema, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import type { PositionsData } from "../../src/domain/portfolio/positions";
import { tokenString } from "../../src/domain/token/token";
import {
  type EarnTokenOption,
  earnSelectionStatusViewAtom,
  earnSelectionViewAtom,
  selectEarnSelectionTokenAtom,
  selectEarnSelectionYieldAtom,
  setEarnSelectionAmountAtom,
} from "../../src/features/earn/state/earn-selection";
import {
  earnYieldCatalogAtom,
  initYieldAtom,
  mergedTokenOptionsAtom,
  positionsDataAtom,
} from "../../src/features/earn/state/earn-selection/catalog/catalog";
import {
  InitYieldKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
} from "../../src/features/earn/state/earn-selection/catalog/keys";
import { EarnCatalogError } from "../../src/features/earn/state/earn-selection/types";
import {
  earnPageInputAtom,
  earnPageQuoteAtom,
  earnPageSearchAtom,
  earnPageSelectionAtom,
  getEarnPageValidationKey,
} from "../../src/features/earn/state/page-workflow";
import { initParamsAtom } from "../../src/features/init-params/state";
import { walletStateResultAtom } from "../../src/features/wallet/state";
import { LegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import {
  type YieldDirectoryRequest,
  YieldResourceSource,
} from "../../src/services/api/yield-resource-source";
import { WalletScopeKey } from "../../src/services/wallet/wallet-scope";
import { WalletService } from "../../src/services/wallet/wallet-service";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/wallet-state";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../fixtures";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

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
 * Seeds every resource Earn Selection reads so the published view reaches
 * `ready` without a network, which is the only status where the removed
 * write-back used to fire.
 */
const makeReadyRegistry = () => {
  const tokenOptions = [toTokenOption(firstYield), toTokenOption(secondYield)];

  return AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue(),
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
      initialValues: [
        applicationRuntimeInitInitialValue(),
        [walletStateResultAtom, AsyncResult.initial(true)],
      ],
    });

    expect(registry.get(earnSelectionStatusViewAtom).status).toBe(
      "resolving-wallet"
    );
    registry.dispose();
  });

  it("treats a failed Wallet Bootstrap attempt as settled", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        [
          walletStateResultAtom,
          AsyncResult.failure(Cause.fail(new Error("wallet bootstrap failed"))),
        ],
      ],
    });

    expect(registry.get(earnSelectionStatusViewAtom).status).not.toBe(
      "resolving-wallet"
    );
    registry.dispose();
  });

  it("opens selection resolution when the initial wallet connects", async () => {
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
        applicationRuntimeInitInitialValue(),
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
    const unmount = registry.mount(earnSelectionStatusViewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(earnSelectionStatusViewAtom).status).toBe(
          "resolving-wallet"
        )
      );

      Effect.runSync(
        SubscriptionRef.set(walletState, makeWalletState(connectedWalletState))
      );

      await vi.waitFor(() =>
        expect(registry.get(earnSelectionStatusViewAtom).status).not.toBe(
          "resolving-wallet"
        )
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("does not reapply startup initialization after connection or route remount", async () => {
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
    const yields = [firstYield, secondYield];
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        [
          appRuntime.layer,
          Layer.mergeAll(
            Reactivity.layer,
            Layer.succeed(
              LegacyResourceSource,
              LegacyResourceSource.of({
                getTokenOptions: () =>
                  Effect.succeed(
                    tokenOptions.map(({ availableYields, token }) => ({
                      availableYields,
                      token,
                    }))
                  ),
                scanTokenBalances: () => Effect.succeed([]),
              } as never)
            ),
            Layer.succeed(
              YieldResourceSource,
              YieldResourceSource.of({
                getOpportunity: () => Effect.succeed(secondYield),
                getPositions: () =>
                  Effect.succeed({
                    items: [],
                    limit: 100,
                    offset: 0,
                    total: 0,
                  }),
                getProvider: () => Effect.succeedNone,
                listYields: ({
                  limit,
                  offset,
                  yieldIds,
                }: YieldDirectoryRequest) =>
                  Effect.succeed({
                    items: yields.filter(
                      (yieldModel) =>
                        !yieldIds || yieldIds.includes(yieldModel.id)
                    ),
                    limit,
                    offset,
                    total: yields.length,
                  }),
              } as never)
            )
          ) as never,
        ],
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
      ],
    });
    const unmountWalletState = registry.mount(walletStateResultAtom);
    let unmount = registry.mount(earnSelectionViewAtom);

    try {
      expect(registry.get(earnSelectionViewAtom).selection.yield).toEqual(
        secondYield
      );

      unmount();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      unmount = registry.mount(earnSelectionViewAtom);

      await vi.waitFor(() => {
        expect(registry.get(earnSelectionStatusViewAtom).status).toBe("ready");
        expect(registry.get(earnSelectionViewAtom).selection.yield).not.toEqual(
          secondYield
        );
      });

      Effect.runSync(
        SubscriptionRef.set(walletState, makeWalletState(connectedWalletState))
      );

      await vi.waitFor(() => {
        const view = registry.get(earnSelectionViewAtom);

        expect(registry.get(earnSelectionStatusViewAtom).status).toBe("ready");
        expect(view.selection.yield).toEqual(firstYield);
      });
    } finally {
      unmount();
      unmountWalletState();
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
        applicationRuntimeInitInitialValue(),
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
    const unmount = registry.mount(earnSelectionViewAtom);

    expect(registry.get(earnSelectionStatusViewAtom).status).toBe(
      "loading-initial-selection"
    );

    registry.set(setEarnSelectionAmountAtom, "1");

    expect(registry.get(earnSelectionViewAtom)).toMatchObject({
      form: { stakeAmount: "1" },
    });
    expect(registry.get(earnSelectionStatusViewAtom).status).toBe(
      "loading-initial-selection"
    );

    registry.set(selectEarnSelectionYieldAtom, firstYield.id);

    expect(registry.get(earnSelectionStatusViewAtom).status).not.toBe(
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
        applicationRuntimeInitInitialValue(),
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
    const unmount = registry.mount(earnSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(earnSelectionStatusViewAtom).status).toBe(
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
        const view = registry.get(earnSelectionViewAtom);

        expect(registry.get(earnSelectionStatusViewAtom).status).toBe("ready");
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
        applicationRuntimeInitInitialValue(),
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

    expect(registry.get(earnSelectionStatusViewAtom).status).toBe("failed");

    registry.set(setEarnSelectionAmountAtom, "1");

    const view = registry.get(earnSelectionViewAtom);
    expect(registry.get(earnSelectionStatusViewAtom).status).toBe("ready");
    expect(view.selection.yield).toEqual(firstYield);
    registry.dispose();
  });

  it("derives input, selection, and quote models from the feature machine", () => {
    const registry = AtomRegistry.make({
      initialValues: [applicationRuntimeInitInitialValue()],
    });

    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("0");
    expect(registry.get(earnPageSelectionAtom).yield).toBeNull();
    expect(registry.get(earnPageQuoteAtom).stakeAmount.toFixed()).toBe("0");
    registry.dispose();
  });

  it("keeps publishing view updates after a command when the first read has no listener", () => {
    const registry = makeReadyRegistry();

    // useSyncExternalStore reads a snapshot during render and only subscribes on
    // commit, so the machine view is first built with no listener attached.
    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("0");
    expect(registry.get(earnSelectionStatusViewAtom).status).toBe("ready");
    registry.subscribe(earnPageInputAtom, () => {}, { immediate: false });

    registry.set(setEarnSelectionAmountAtom, "5");
    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("5");

    registry.set(setEarnSelectionAmountAtom, "7");
    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("7");
    registry.dispose();
  });

  it("discards page-local search state when its entry surface is released", async () => {
    const registry = AtomRegistry.make({
      initialValues: [applicationRuntimeInitInitialValue()],
    });
    let unmount = registry.mount(earnPageSearchAtom);

    registry.set(earnPageSearchAtom, {
      stake: "ethereum",
      token: "eth",
    });
    expect(registry.get(earnPageSearchAtom).token).toBe("eth");

    unmount();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    unmount = registry.mount(earnPageSearchAtom);

    expect(registry.get(earnPageSearchAtom)).toEqual({ stake: "", token: "" });
    unmount();
    registry.dispose();
  });

  it("keys validation attempts by category, selected yield, and selected token", () => {
    const registry = makeReadyRegistry();
    const initialKey = getEarnPageValidationKey(
      registry.get(earnSelectionViewAtom).selection
    );

    registry.set(setEarnSelectionAmountAtom, "1");
    expect(
      getEarnPageValidationKey(registry.get(earnSelectionViewAtom).selection)
    ).toBe(initialKey);

    registry.set(selectEarnSelectionTokenAtom, tokenString(secondYield.token));
    expect(
      getEarnPageValidationKey(registry.get(earnSelectionViewAtom).selection)
    ).not.toBe(initialKey);
    registry.dispose();
  });
});
