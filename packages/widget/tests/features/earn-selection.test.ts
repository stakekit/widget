import { Cause, Effect, Layer, Option, Schema, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { updateWidgetConfigAtom } from "../../src/app/runtime/widget-config";
import type { EarnValidator, EarnYield } from "../../src/domain/earn/models";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import type { PositionsData } from "../../src/domain/portfolio/positions";
import { tokenString } from "../../src/domain/token/token";
import { earnEntryIntentEventProjectionAtom } from "../../src/features/earn/state";
import {
  type EarnTokenOption,
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  earnSelectionValidatorOptionsViewAtom,
  earnSelectionViewAtom,
  earnSelectionYieldOptionsViewAtom,
  loadMoreEarnSelectionTokensAtom,
  loadMoreEarnSelectionValidatorsAtom,
  removeEarnSelectionValidatorAtom,
  retryEarnSelectionAtom,
  selectEarnSelectionCategoryAtom,
  selectEarnSelectionProviderAtom,
  selectEarnSelectionTokenAtom,
  selectEarnSelectionTronResourceAtom,
  selectEarnSelectionValidatorAtom,
  selectEarnSelectionYieldAtom,
  setEarnSelectionAmountAtom,
  setEarnSelectionMaxAmountAtom,
  setEarnSelectionValidatorSearchAtom,
} from "../../src/features/earn/state/earn-selection";
import {
  availableYieldCategoriesAtom,
  earnYieldCatalogAtom,
  initYieldAtom,
  mergedTokenOptionsAtom,
  positionsDataAtom,
  tokenOptionsPullAtom,
  yieldValidatorsAtom,
} from "../../src/features/earn/state/earn-selection/catalog/catalog";
import {
  AvailableYieldCategoriesKey,
  DefaultTokenOptionsKey,
  InitYieldKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
  YieldValidatorsKey,
  YieldValidatorsPullKey,
} from "../../src/features/earn/state/earn-selection/catalog/keys";
import { earnMachineEntryAtom } from "../../src/features/earn/state/earn-selection/state/atoms";
import {
  EarnCatalogError,
  type EarnEntry,
} from "../../src/features/earn/state/earn-selection/types";
import {
  type ValidatorDirectoryRequest,
  YieldResourceSource,
} from "../../src/services/api/yield-resource-source";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../src/services/events/widget-domain-events";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../src/services/wallet/wallet-scope";
import {
  yieldApiValidatorFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { decodeValidator } from "../utils/validators";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

const firstYield = yieldApiYieldFixture();
const secondYield = yieldApiYieldFixture({
  id: "ethereum-usdc-lending",
  token: {
    ...firstYield.token,
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    name: "USD Coin",
    symbol: "USDC",
  },
});
const alternateYield = yieldApiYieldFixture({
  id: "ethereum-eth-liquid-staking",
});

const toTokenOption = (
  yieldModel: EarnYield,
  availableYields = [yieldModel.id]
): EarnTokenOption => ({
  amount: "10",
  availableYields,
  source: "balance",
  token: yieldModel.token,
});

const classicEntry: EarnEntry = {
  categoryOrder: ["stake", "defi", "rwa"],
  dashboardVariant: false,
  initParams: null,
  preferredTokenYieldsPerNetwork: null,
  tokensForEnabledYieldsOnly: false,
  walletResolution: "settled",
  walletScope: null,
};
const categoryOrder = ["stake", "defi", "rwa"] as const;
const classicTokenPullKey = new DefaultTokenOptionsKey({
  category: null,
  network: null,
  tokensForEnabledYieldsOnly: false,
});
const classicTokenOptionsKey = new TokenOptionsKey({
  category: null,
  initToken: null,
  initTokenNetwork: null,
  initYieldId: null,
  scope: null,
  tokensForEnabledYieldsOnly: false,
});

const makeClassicRegistry = ({
  positionsResult = AsyncResult.success(new Map() as PositionsData),
  tokenOptions = [toTokenOption(firstYield)],
  tokenOptionsResult = AsyncResult.success(tokenOptions),
  yields = [firstYield],
  yieldsResult = AsyncResult.success(yields),
}: {
  readonly positionsResult?: AsyncResult.AsyncResult<
    PositionsData,
    EarnCatalogError
  >;
  readonly tokenOptions?: ReadonlyArray<EarnTokenOption>;
  readonly tokenOptionsResult?: AsyncResult.AsyncResult<
    ReadonlyArray<EarnTokenOption>,
    EarnCatalogError
  >;
  readonly yields?: ReadonlyArray<EarnYield>;
  readonly yieldsResult?: AsyncResult.AsyncResult<
    ReadonlyArray<EarnYield>,
    EarnCatalogError
  >;
} = {}) =>
  AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue(),
      Atom.initialValue(earnMachineEntryAtom, classicEntry),
      [
        initYieldAtom(new InitYieldKey({ yieldId: null })),
        AsyncResult.success(null),
      ],
      [mergedTokenOptionsAtom(classicTokenOptionsKey), tokenOptionsResult],
      [
        tokenOptionsPullAtom(classicTokenPullKey),
        AsyncResult.success({
          done: false,
          items: [{ hasNextPage: true, items: tokenOptions }],
        }),
      ],
      ...yields.flatMap((yieldModel) => [
        [
          initYieldAtom(new InitYieldKey({ yieldId: yieldModel.id })),
          AsyncResult.success(yieldModel),
        ] as const,
        [
          mergedTokenOptionsAtom(
            new TokenOptionsKey({
              category: null,
              initToken: null,
              initTokenNetwork: null,
              initYieldId: yieldModel.id,
              scope: null,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          tokenOptionsResult,
        ] as const,
      ]),
      [
        positionsDataAtom(new PositionsDataKey({ scope: null })),
        positionsResult,
      ],
      ...tokenOptions.map(
        (option) =>
          [
            earnYieldCatalogAtom(
              new YieldCatalogKey({
                category: null,
                network: option.token.network,
                yieldIds: option.availableYields,
              })
            ),
            yieldsResult,
          ] as const
      ),
    ],
  });

const makeRequiredValidatorRegistry = (
  validatorsResult: AsyncResult.AsyncResult<
    ReadonlyArray<EarnValidator>,
    EarnCatalogError
  >,
  {
    multiselect = false,
    pageDone = true,
    pageItems = [],
  }: {
    readonly multiselect?: boolean;
    readonly pageDone?: boolean;
    readonly pageItems?: ReadonlyArray<EarnValidator>;
  } = {}
) => {
  const requiredYield = {
    ...firstYield,
    mechanics: {
      ...firstYield.mechanics,
      arguments: multiselect
        ? {
            ...firstYield.mechanics.arguments,
            enter: {
              fields: {
                validatorAddresses: { required: true },
              },
            },
          }
        : firstYield.mechanics.arguments,
      requiresValidatorSelection: true,
    },
  } satisfies EarnYield;
  const validators = yieldValidatorsAtom(
    new YieldValidatorsKey({
      network: requiredYield.token.network,
      selectedYieldId: requiredYield.id,
    })
  );

  return {
    registry: AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(earnMachineEntryAtom, classicEntry),
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
          AsyncResult.success([toTokenOption(requiredYield)]),
        ],
        [
          positionsDataAtom(new PositionsDataKey({ scope: null })),
          AsyncResult.success(new Map() as PositionsData),
        ],
        [
          earnYieldCatalogAtom(
            new YieldCatalogKey({
              category: null,
              network: requiredYield.token.network,
              yieldIds: [requiredYield.id],
            })
          ),
          AsyncResult.success([requiredYield]),
        ],
        [validators.initialValidatorsResultAtom, validatorsResult],
        [
          validators.validatorsPullAtom(
            new YieldValidatorsPullKey({ search: null })
          ),
          AsyncResult.success({
            done: pageDone,
            items: [{ hasNextPage: !pageDone, items: pageItems }],
          }),
        ],
      ],
    }),
    requiredYield,
    validators,
  };
};

const makeDashboardRegistry = () => {
  const categories = ["stake", "defi"] as const;
  const categorySelections = [
    { category: "stake" as const, yieldModel: firstYield },
    { category: "defi" as const, yieldModel: secondYield },
  ];

  return AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue({
        apiKey: "test-key",
        dashboardVariant: true,
        variant: "default",
        yieldGrouping: "category",
      }),
      Atom.initialValue(earnMachineEntryAtom, {
        ...classicEntry,
        categoryOrder,
        dashboardVariant: true,
      }),
      [
        initYieldAtom(new InitYieldKey({ yieldId: null })),
        AsyncResult.success(null),
      ],
      [
        availableYieldCategoriesAtom(
          new AvailableYieldCategoriesKey({
            categoryOrder,
            network: null,
          })
        ),
        AsyncResult.success(categories),
      ],
      [
        positionsDataAtom(new PositionsDataKey({ scope: null })),
        AsyncResult.success(new Map() as PositionsData),
      ],
      ...categorySelections.flatMap(({ category, yieldModel }) => [
        [
          mergedTokenOptionsAtom(
            new TokenOptionsKey({
              category,
              initToken: null,
              initTokenNetwork: null,
              initYieldId: null,
              scope: null,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          AsyncResult.success([toTokenOption(yieldModel)]),
        ] as const,
        [
          earnYieldCatalogAtom(
            new YieldCatalogKey({
              category,
              network: yieldModel.token.network,
              yieldIds: [yieldModel.id],
            })
          ),
          AsyncResult.success([yieldModel]),
        ] as const,
      ]),
    ],
  });
};

describe("Earn Selection", () => {
  it("discards Entry Intent when its entry surface is released", async () => {
    const registry = makeClassicRegistry();
    const unmount = registry.mount(earnSelectionViewAtom);
    registry.set(setEarnSelectionAmountAtom, "5");
    expect(registry.get(earnSelectionViewAtom).form.stakeAmount).toBe("5");

    unmount();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const remount = registry.mount(earnSelectionViewAtom);
    expect(registry.get(earnSelectionViewAtom).form.stakeAmount).toBe("0");

    remount();
    registry.dispose();
  });

  it("consumes Entry Intent only for the workflow owner", async () => {
    const ownerScope = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0x0000000000000000000000000000000000000001"
      ),
      network: "ethereum",
    });
    const otherScope = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0x0000000000000000000000000000000000000002"
      ),
      network: "ethereum",
    });
    const events = Effect.runSync(
      SubscriptionRef.make<WidgetDomainEvent>({
        _tag: "TransactionWorkflowStarted",
        owner: walletScopeOwnerKey(otherScope),
      })
    );
    const tokenOptions = [toTokenOption(firstYield)];
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            WidgetDomainEvents,
            WidgetDomainEvents.of({
              events: SubscriptionRef.changes(events),
              publish: () => Effect.void,
            })
          ) as never
        ),
        Atom.initialValue(earnMachineEntryAtom, {
          ...classicEntry,
          walletScope: ownerScope,
        }),
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
              scope: ownerScope,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          AsyncResult.success(tokenOptions),
        ],
        [
          positionsDataAtom(new PositionsDataKey({ scope: ownerScope })),
          AsyncResult.success(new Map() as PositionsData),
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
    const unmountProjection = registry.mount(
      earnEntryIntentEventProjectionAtom
    );
    const unmountView = registry.mount(earnSelectionViewAtom);

    registry.set(setEarnSelectionAmountAtom, "5");
    expect(registry.get(earnSelectionViewAtom).form.stakeAmount).toBe("5");
    await Effect.runPromise(
      SubscriptionRef.set(events, {
        _tag: "TransactionWorkflowEnded",
        owner: walletScopeOwnerKey(ownerScope),
        workflowKind: "Classic",
      })
    );
    expect(registry.get(earnSelectionViewAtom).form.stakeAmount).toBe("5");

    await Effect.runPromise(
      SubscriptionRef.set(events, {
        _tag: "TransactionWorkflowStarted",
        owner: walletScopeOwnerKey(ownerScope),
      })
    );
    await vi.waitFor(() =>
      expect(registry.get(earnSelectionViewAtom).form.stakeAmount).toBe("0")
    );

    unmountView();
    unmountProjection();
    registry.dispose();
  });

  it("discards validator search when its entry surface is released", async () => {
    const registry = AtomRegistry.make({
      initialValues: [applicationRuntimeInitInitialValue()],
    });
    let unmount = registry.mount(earnSelectionValidatorOptionsViewAtom);

    try {
      registry.set(setEarnSelectionValidatorSearchAtom, "  cosmos  ");

      expect(registry.get(earnSelectionValidatorOptionsViewAtom)).toMatchObject(
        {
          isDebouncing: true,
          search: "  cosmos  ",
        }
      );

      unmount();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      unmount = registry.mount(earnSelectionValidatorOptionsViewAtom);

      expect(registry.get(earnSelectionValidatorOptionsViewAtom)).toMatchObject(
        {
          search: "",
        }
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("publishes focused semantic views without resource identity", () => {
    const registry = makeClassicRegistry();

    try {
      expect(registry.get(earnSelectionStatusViewAtom)).toEqual({
        canRetry: false,
        failureStage: null,
        isFetching: false,
        status: "ready",
      });
      expect(registry.get(earnSelectionViewAtom)).toMatchObject({
        canSubmit: false,
        form: { stakeAmount: "0" },
        selection: {
          category: null,
          token: toTokenOption(firstYield),
          yield: firstYield,
        },
      });
      expect(registry.get(earnSelectionTokenOptionsViewAtom)).toMatchObject({
        page: { hasMore: true, isLoadingMore: false },
      });
      expect(
        registry.get(earnSelectionTokenOptionsViewAtom)
      ).not.toHaveProperty("pullKey");
      expect(
        registry.get(earnSelectionYieldOptionsViewAtom)
      ).not.toHaveProperty("key");
      expect(registry.get(earnSelectionStatusViewAtom)).not.toHaveProperty(
        "retryTarget"
      );
    } finally {
      registry.dispose();
    }
  });

  it.each([
    {
      expectedStatus: "loading-token-options",
      tokenOptionsResult: AsyncResult.initial<
        ReadonlyArray<EarnTokenOption>,
        EarnCatalogError
      >(true),
      yieldsResult: AsyncResult.success([firstYield]),
    },
    {
      expectedStatus: "no-tokens",
      tokenOptionsResult: AsyncResult.success<
        ReadonlyArray<EarnTokenOption>,
        EarnCatalogError
      >([]),
      yieldsResult: AsyncResult.success([firstYield]),
    },
    {
      expectedStatus: "loading-yields",
      tokenOptionsResult: AsyncResult.success([toTokenOption(firstYield)]),
      yieldsResult: AsyncResult.initial<
        ReadonlyArray<EarnYield>,
        EarnCatalogError
      >(true),
    },
    {
      expectedStatus: "no-yields",
      tokenOptionsResult: AsyncResult.success([toTokenOption(firstYield)]),
      yieldsResult: AsyncResult.success<
        ReadonlyArray<EarnYield>,
        EarnCatalogError
      >([]),
    },
  ] as const)(
    "publishes $expectedStatus through the status view",
    ({ expectedStatus, tokenOptionsResult, yieldsResult }) => {
      const registry = makeClassicRegistry({
        tokenOptionsResult,
        yieldsResult,
      });

      try {
        expect(registry.get(earnSelectionStatusViewAtom).status).toBe(
          expectedStatus
        );
      } finally {
        registry.dispose();
      }
    }
  );

  it("resolves semantic token, yield, and amount commands", () => {
    const sharedToken = toTokenOption(firstYield, [
      firstYield.id,
      alternateYield.id,
    ]);
    const registry = makeClassicRegistry({
      tokenOptions: [sharedToken, toTokenOption(secondYield)],
      yields: [firstYield, alternateYield, secondYield],
      yieldsResult: AsyncResult.success([
        firstYield,
        alternateYield,
        secondYield,
      ]),
    });

    try {
      registry.set(selectEarnSelectionYieldAtom, alternateYield.id);
      expect(registry.get(earnSelectionViewAtom).selection.yield).toEqual(
        alternateYield
      );

      registry.set(setEarnSelectionAmountAtom, "2.5");
      expect(registry.get(earnSelectionViewAtom).form.stakeAmount).toBe("2.5");

      registry.set(setEarnSelectionMaxAmountAtom, "9");
      expect(registry.get(earnSelectionViewAtom).form).toMatchObject({
        stakeAmount: "9",
        useMaxAmount: true,
      });

      registry.set(
        selectEarnSelectionTokenAtom,
        tokenString(secondYield.token)
      );
      expect(registry.get(earnSelectionViewAtom)).toMatchObject({
        form: { stakeAmount: "0" },
        selection: {
          token: toTokenOption(secondYield),
          yield: secondYield,
        },
      });
    } finally {
      registry.dispose();
    }
  });

  it("owns provider and Tron form commands for supported yield arguments", () => {
    const yieldDto = yieldApiYieldDtoFixture();
    const configurableYield = yieldApiYieldFixture({
      id: "ethereum-eth-configurable-staking",
      mechanics: {
        ...yieldDto.mechanics,
        arguments: {
          ...yieldDto.mechanics.arguments,
          enter: {
            fields: [
              {
                label: "Provider",
                name: "providerId",
                options: [firstYield.id, alternateYield.id],
                required: true,
                type: "string",
              },
              {
                label: "Resource",
                name: "tronResource",
                options: ["BANDWIDTH", "ENERGY"],
                type: "enum",
              },
            ],
          },
        },
      },
    });
    const registry = makeClassicRegistry({
      tokenOptions: [toTokenOption(configurableYield)],
      yields: [configurableYield],
      yieldsResult: AsyncResult.success([configurableYield]),
    });

    try {
      registry.set(selectEarnSelectionProviderAtom, alternateYield.id);
      registry.set(selectEarnSelectionTronResourceAtom, "ENERGY");

      expect(registry.get(earnSelectionViewAtom).form).toMatchObject({
        providerYieldId: alternateYield.id,
        tronResource: "ENERGY",
      });
    } finally {
      registry.dispose();
    }
  });

  it("owns dashboard category transitions and their downstream reset", () => {
    const registry = makeDashboardRegistry();

    try {
      expect(registry.get(earnSelectionViewAtom).selection).toMatchObject({
        category: "stake",
        token: toTokenOption(firstYield),
        yield: firstYield,
      });

      registry.set(selectEarnSelectionCategoryAtom, "defi");

      expect(registry.get(earnSelectionViewAtom).selection).toMatchObject({
        category: "defi",
        token: toTokenOption(secondYield),
        yield: secondYield,
      });
    } finally {
      registry.dispose();
    }
  });

  it("publishes only the semantic stage for a blocking failure", () => {
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "token-balances-scan",
    });
    const registry = makeClassicRegistry({
      tokenOptionsResult: AsyncResult.failure(Cause.fail(error)),
    });
    const refresh = vi.spyOn(registry, "refresh");

    try {
      expect(registry.get(earnSelectionStatusViewAtom)).toEqual({
        canRetry: true,
        failureStage: "token-options",
        isFetching: false,
        status: "failed",
      });
      expect(registry.get(earnSelectionStatusViewAtom)).not.toHaveProperty(
        "error"
      );

      registry.set(retryEarnSelectionAtom, undefined);
      expect(refresh).toHaveBeenCalledWith(
        mergedTokenOptionsAtom(classicTokenOptionsKey)
      );
    } finally {
      registry.dispose();
    }
  });

  it("retains readiness and usable options after a refresh failure", () => {
    const tokenOption = toTokenOption(firstYield);
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "token-balances-scan",
    });
    const registry = makeClassicRegistry({
      tokenOptionsResult: AsyncResult.failure(Cause.fail(error), {
        previousSuccess: Option.some(AsyncResult.success([tokenOption])),
      }),
    });

    try {
      expect(registry.get(earnSelectionStatusViewAtom)).toMatchObject({
        canRetry: false,
        failureStage: null,
        status: "ready",
      });
      expect(registry.get(earnSelectionTokenOptionsViewAtom).items).toEqual([
        tokenOption,
      ]);
    } finally {
      registry.dispose();
    }
  });

  it("routes token pagination without publishing its resource key", () => {
    const registry = makeClassicRegistry();
    const set = vi.spyOn(registry, "set");

    try {
      expect(registry.get(earnSelectionTokenOptionsViewAtom).page.hasMore).toBe(
        true
      );

      registry.set(loadMoreEarnSelectionTokensAtom, undefined);

      expect(set).toHaveBeenCalledWith(
        tokenOptionsPullAtom(classicTokenPullKey),
        undefined
      );
    } finally {
      registry.dispose();
    }
  });

  it("keeps an authoritative API-scoped yield selectable by identifier", () => {
    const visibleYield = yieldApiYieldFixture({
      id: "avax-native-staking",
    });
    const registry = makeClassicRegistry({
      tokenOptions: [toTokenOption(visibleYield)],
      yields: [visibleYield],
      yieldsResult: AsyncResult.success([visibleYield]),
    });

    try {
      expect(registry.get(earnSelectionViewAtom).selection.yield).toEqual(
        visibleYield
      );
      expect(registry.get(earnSelectionStatusViewAtom).status).toBe("ready");
    } finally {
      registry.dispose();
    }
  });

  it("waits for positions before publishing readiness", () => {
    const registry = makeClassicRegistry({
      positionsResult: AsyncResult.initial(true),
    });

    try {
      expect(registry.get(earnSelectionStatusViewAtom)).toMatchObject({
        isFetching: true,
        status: "loading-positions",
      });
      expect(registry.get(earnSelectionViewAtom).canSubmit).toBe(false);
    } finally {
      registry.dispose();
    }
  });

  it.each([
    {
      categories: AsyncResult.initial(true),
      expectedStatus: "loading-categories",
    },
    {
      categories: AsyncResult.success([]),
      expectedStatus: "no-categories",
    },
  ] as const)(
    "publishes $expectedStatus from category discovery",
    ({ categories, expectedStatus }) => {
      const registry = AtomRegistry.make({
        initialValues: [
          applicationRuntimeInitInitialValue({
            apiKey: "test-key",
            dashboardVariant: true,
            variant: "default",
          }),
          Atom.initialValue(earnMachineEntryAtom, {
            ...classicEntry,
            categoryOrder,
            dashboardVariant: true,
          }),
          [
            initYieldAtom(new InitYieldKey({ yieldId: null })),
            AsyncResult.success(null),
          ],
          [
            availableYieldCategoriesAtom(
              new AvailableYieldCategoriesKey({
                categoryOrder,
                network: null,
              })
            ),
            categories,
          ],
          [
            positionsDataAtom(new PositionsDataKey({ scope: null })),
            AsyncResult.success(new Map() as PositionsData),
          ],
        ],
      });

      try {
        expect(registry.get(earnSelectionStatusViewAtom).status).toBe(
          expectedStatus
        );
      } finally {
        registry.dispose();
      }
    }
  );

  it("publishes required validator acquisition through its stable view", () => {
    const validator = decodeValidator(yieldApiValidatorFixture());
    const { registry, requiredYield } = makeRequiredValidatorRegistry(
      AsyncResult.success([validator])
    );

    try {
      expect(registry.get(earnSelectionStatusViewAtom).status).toBe("ready");
      expect(registry.get(earnSelectionValidatorOptionsViewAtom)).toMatchObject(
        {
          canSelect: true,
          enabled: true,
          items: [validator],
          selectedYield: requiredYield,
        }
      );
    } finally {
      registry.dispose();
    }
  });

  it("owns validator selection, removal, memory, and pagination", () => {
    const firstValidator = decodeValidator(yieldApiValidatorFixture());
    const secondValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "0x2222222222222222222222222222222222222222",
        name: "Second Validator",
      })
    );
    const { registry, validators } = makeRequiredValidatorRegistry(
      AsyncResult.success([firstValidator, secondValidator]),
      {
        multiselect: true,
        pageDone: false,
        pageItems: [firstValidator, secondValidator],
      }
    );
    const pull = validators.validatorsPullAtom(
      new YieldValidatorsPullKey({ search: null })
    );
    const set = vi.spyOn(registry, "set");

    try {
      registry.set(selectEarnSelectionValidatorAtom, firstValidator.key);
      registry.set(selectEarnSelectionValidatorAtom, secondValidator.key);
      expect(
        registry
          .get(earnSelectionValidatorOptionsViewAtom)
          .selected.map((validator) => validator.key)
      ).toEqual([firstValidator.key, secondValidator.key]);

      registry.set(removeEarnSelectionValidatorAtom, firstValidator.key);
      expect(
        registry
          .get(earnSelectionValidatorOptionsViewAtom)
          .selected.map((validator) => validator.key)
      ).toEqual([secondValidator.key]);

      expect(
        registry.get(earnSelectionValidatorOptionsViewAtom).page.hasMore
      ).toBe(true);
      registry.set(loadMoreEarnSelectionValidatorsAtom, undefined);
      expect(set).toHaveBeenCalledWith(pull, undefined);
    } finally {
      registry.dispose();
    }
  });

  it.each([
    { mode: "single-select", multiselect: false },
    { mode: "multi-select", multiselect: true },
  ])(
    "reconciles $mode validator selection after a host policy update",
    async ({ multiselect }) => {
      const selectedValidator = decodeValidator(
        yieldApiValidatorFixture({
          address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          name: "Selected Validator",
        })
      );
      const fallbackValidator = decodeValidator(
        yieldApiValidatorFixture({
          address: "0x1111111111111111111111111111111111111111",
          name: "Fallback Validator",
          preferred: true,
        })
      );
      const requiredYield = {
        ...firstYield,
        mechanics: {
          ...firstYield.mechanics,
          arguments: multiselect
            ? {
                ...firstYield.mechanics.arguments,
                enter: {
                  fields: {
                    validatorAddresses: { required: true },
                  },
                },
              }
            : firstYield.mechanics.arguments,
          requiresValidatorSelection: true,
        },
      } satisfies EarnYield;
      const registry = AtomRegistry.make({
        initialValues: [
          applicationRuntimeInitInitialValue(),
          Atom.initialValue(earnMachineEntryAtom, classicEntry),
          Atom.initialValue(
            appRuntime.layer,
            Layer.succeed(
              YieldResourceSource,
              YieldResourceSource.of({
                listValidators: (request: ValidatorDirectoryRequest) =>
                  Effect.succeed({
                    items: request.preferred
                      ? []
                      : [selectedValidator, fallbackValidator],
                    limit: request.limit,
                    offset: request.offset,
                    total: request.preferred ? 0 : 2,
                  }),
              } as never)
            )
          ),
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
            AsyncResult.success([toTokenOption(requiredYield)]),
          ],
          [
            positionsDataAtom(new PositionsDataKey({ scope: null })),
            AsyncResult.success(new Map() as PositionsData),
          ],
          [
            earnYieldCatalogAtom(
              new YieldCatalogKey({
                category: null,
                network: requiredYield.token.network,
                yieldIds: [requiredYield.id],
              })
            ),
            AsyncResult.success([requiredYield]),
          ],
        ],
      });
      const unmount = registry.mount(earnSelectionValidatorOptionsViewAtom);

      try {
        await vi.waitFor(() =>
          expect(
            registry
              .get(earnSelectionValidatorOptionsViewAtom)
              .items.map((validator) => validator.key)
          ).toEqual([fallbackValidator.key, selectedValidator.key])
        );

        registry.set(selectEarnSelectionValidatorAtom, selectedValidator.key);
        expect(
          registry
            .get(earnSelectionValidatorOptionsViewAtom)
            .selected.map((validator) => validator.key)
        ).toEqual(
          multiselect
            ? [fallbackValidator.key, selectedValidator.key]
            : [selectedValidator.key]
        );

        registry.set(updateWidgetConfigAtom, {
          apiKey: "test-api-key",
          validatorsConfig: {
            ethereum: {
              blocked: ["0xAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCd"],
            },
          },
          variant: "default",
        });

        await vi.waitFor(() =>
          expect(
            registry
              .get(earnSelectionValidatorOptionsViewAtom)
              .selected.map((validator) => validator.key)
          ).toEqual([fallbackValidator.key])
        );

        registry.set(updateWidgetConfigAtom, {
          apiKey: "test-api-key",
          variant: "default",
        });

        await vi.waitFor(() =>
          expect(
            registry
              .get(earnSelectionValidatorOptionsViewAtom)
              .selected.map((validator) => validator.key)
          ).toEqual([fallbackValidator.key])
        );

        registry.set(updateWidgetConfigAtom, {
          apiKey: "test-api-key",
          validatorsConfig: {
            ethereum: {
              blocked: [selectedValidator.address, fallbackValidator.address],
            },
          },
          variant: "default",
        });

        await vi.waitFor(() => {
          expect(
            registry.get(earnSelectionValidatorOptionsViewAtom).selected
          ).toEqual([]);
          expect(registry.get(earnSelectionStatusViewAtom).status).toBe(
            "no-validators"
          );
        });
      } finally {
        unmount();
        registry.dispose();
      }
    }
  );

  it.each([
    {
      expectedFailureStage: null,
      expectedStatus: "loading-validators",
      result: AsyncResult.initial<
        ReadonlyArray<EarnValidator>,
        EarnCatalogError
      >(true),
    },
    {
      expectedFailureStage: null,
      expectedStatus: "no-validators",
      result: AsyncResult.success<
        ReadonlyArray<EarnValidator>,
        EarnCatalogError
      >([]),
    },
    {
      expectedFailureStage: "validators",
      expectedStatus: "failed",
      result: AsyncResult.failure<
        ReadonlyArray<EarnValidator>,
        EarnCatalogError
      >(
        Cause.fail(
          new EarnCatalogError({
            cause: new Error("offline"),
            operation: "validators",
          })
        )
      ),
    },
  ] as const)(
    "publishes $expectedStatus for required validators",
    ({ expectedFailureStage, expectedStatus, result }) => {
      const { registry } = makeRequiredValidatorRegistry(result);

      try {
        expect(registry.get(earnSelectionStatusViewAtom)).toMatchObject({
          failureStage: expectedFailureStage,
          status: expectedStatus,
        });
      } finally {
        registry.dispose();
      }
    }
  );
});
