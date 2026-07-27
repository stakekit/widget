import { Cause, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  EarnValidator,
  type EarnYield,
} from "../../src/domain/schema/earn-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { PositionsData } from "../../src/domain/types/positions";
import { tokenString } from "../../src/domain/types/tokens";
import {
  availableYieldCategoriesAtom,
  earnYieldCatalogAtom,
  initYieldAtom,
  mergedTokenOptionsAtom,
  positionsDataAtom,
  yieldValidatorsAtom,
} from "../../src/features/earn/state/atoms-state/catalog/atoms";
import {
  AvailableYieldCategoriesKey,
  InitYieldKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
  YieldValidatorsKey,
} from "../../src/features/earn/state/atoms-state/catalog/keys";
import { resolveEarnView } from "../../src/features/earn/state/atoms-state/resolver/view";
import {
  EarnCatalogError,
  type EarnEntry,
  type EarnTokenOption,
  makeDefaultEarnIntent,
} from "../../src/features/earn/state/atoms-state/types";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";

const entry: EarnEntry = {
  categoryOrder: ["stake", "defi", "rwa"],
  dashboardVariant: true,
  initParams: null,
  preferredTokenYieldsPerNetwork: null,
  tokensForEnabledYieldsOnly: false,
  walletResolution: "settled",
  walletScope: null,
};

const yieldModel = yieldApiYieldFixture();
const tokenOption = {
  amount: "10",
  availableYields: [yieldModel.id],
  source: "balance" as const,
  token: yieldModel.token,
} satisfies EarnTokenOption;
const walletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)("0xwallet"),
  network: "ethereum",
});

const resolveClassicView = ({
  positionsResult = AsyncResult.success(new Map() as PositionsData),
  intent = makeDefaultEarnIntent(),
  scope = walletScope as WalletScopeKey | null,
  tokenOptionsResult = AsyncResult.success([tokenOption]),
  yieldsResult = AsyncResult.success([yieldModel]),
}: {
  intent?: ReturnType<typeof makeDefaultEarnIntent>;
  positionsResult?: AsyncResult.AsyncResult<PositionsData, EarnCatalogError>;
  scope?: WalletScopeKey | null;
  tokenOptionsResult?: AsyncResult.AsyncResult<
    ReadonlyArray<EarnTokenOption>,
    EarnCatalogError
  >;
  yieldsResult?: AsyncResult.AsyncResult<
    ReadonlyArray<EarnYield>,
    EarnCatalogError
  >;
}) => {
  const selectionSeedYieldId = intent.selectedYieldId;
  const classicEntry = {
    ...entry,
    dashboardVariant: false,
    walletScope: scope,
  };
  const registry = AtomRegistry.make({
    initialValues: [
      [
        initYieldAtom(new InitYieldKey({ yieldId: selectionSeedYieldId })),
        AsyncResult.success(null),
      ],
      [
        mergedTokenOptionsAtom(
          new TokenOptionsKey({
            category: null,
            initToken: null,
            initTokenNetwork: null,
            initYieldId: selectionSeedYieldId,
            scope,
            tokensForEnabledYieldsOnly: false,
          })
        ),
        tokenOptionsResult,
      ],
      [positionsDataAtom(new PositionsDataKey({ scope })), positionsResult],
      [
        earnYieldCatalogAtom(
          new YieldCatalogKey({
            category: null,
            network: yieldModel.token.network,
            yieldIds: [yieldModel.id],
          })
        ),
        yieldsResult,
      ],
    ],
  });

  return registry.get(
    Atom.make((context) =>
      resolveEarnView({
        context,
        entry: classicEntry,
        intent,
      })
    )
  );
};

const resolveRequiredValidatorView = (
  validatorsResult: AsyncResult.AsyncResult<
    ReadonlyArray<typeof EarnValidator.Type>,
    EarnCatalogError
  >
) => {
  const base = yieldApiYieldFixture();
  const requiredYield = {
    ...base,
    mechanics: { ...base.mechanics, requiresValidatorSelection: true },
  } satisfies EarnYield;
  const requiredToken = {
    ...tokenOption,
    availableYields: [requiredYield.id],
    token: requiredYield.token,
  } satisfies EarnTokenOption;
  const validators = yieldValidatorsAtom(
    new YieldValidatorsKey({
      network: requiredYield.token.network,
      selectedYieldId: requiredYield.id,
    })
  );
  const registry = AtomRegistry.make({
    initialValues: [
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
            scope: walletScope,
            tokensForEnabledYieldsOnly: false,
          })
        ),
        AsyncResult.success([requiredToken]),
      ],
      [
        positionsDataAtom(new PositionsDataKey({ scope: walletScope })),
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
    ],
  });

  return registry.get(
    Atom.make((context) =>
      resolveEarnView({
        context,
        entry: { ...entry, dashboardVariant: false, walletScope },
        intent: makeDefaultEarnIntent(),
      })
    )
  );
};

describe("Earn state machine view", () => {
  const refreshFailure = <A>(value: A, error: EarnCatalogError) =>
    AsyncResult.failure<A, EarnCatalogError>(Cause.fail(error), {
      previousSuccess: Option.some(AsyncResult.success(value)),
    });

  it("never enables submission without a connected wallet owner", () => {
    const view = resolveClassicView({ scope: null });

    expect(view.status).toBe("ready");
    expect(view.can.submit).toBe(false);
  });

  it("waits for dashboard category discovery before resolving tokens", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        [
          initYieldAtom(new InitYieldKey({ yieldId: null })),
          AsyncResult.success(null),
        ],
        [
          availableYieldCategoriesAtom(
            new AvailableYieldCategoriesKey({
              categoryOrder: entry.categoryOrder,
              network: null,
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
              scope: null,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          AsyncResult.success([]),
        ],
        [
          positionsDataAtom(new PositionsDataKey({ scope: null })),
          AsyncResult.success(new Map()),
        ],
      ],
    });
    const view = registry.get(
      Atom.make((context) =>
        resolveEarnView({
          context,
          entry,
          intent: makeDefaultEarnIntent(),
        })
      )
    );

    expect(view.status).toBe("loading-categories");
    expect(view.selection.category).toBeNull();
    expect(view.can).toEqual({
      selectToken: false,
      selectValidator: false,
      selectYield: false,
      submit: false,
    });
  });

  it("publishes no categories after successful empty discovery", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        [
          initYieldAtom(new InitYieldKey({ yieldId: null })),
          AsyncResult.success(null),
        ],
        [
          availableYieldCategoriesAtom(
            new AvailableYieldCategoriesKey({
              categoryOrder: entry.categoryOrder,
              network: null,
            })
          ),
          AsyncResult.success([]),
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
          AsyncResult.success([]),
        ],
        [
          positionsDataAtom(new PositionsDataKey({ scope: null })),
          AsyncResult.success(new Map()),
        ],
      ],
    });
    const view = registry.get(
      Atom.make((context) =>
        resolveEarnView({
          context,
          entry,
          intent: makeDefaultEarnIntent(),
        })
      )
    );

    expect(view.status).toBe("no-categories");
    expect(view.selection.category).toBeNull();
  });

  it("distinguishes first token acquisition failure from no tokens", () => {
    const classicEntry = { ...entry, dashboardVariant: false };
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "token-balances-scan",
    });
    const registry = AtomRegistry.make({
      initialValues: [
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
          AsyncResult.failure(Cause.fail(error)),
        ],
        [
          positionsDataAtom(new PositionsDataKey({ scope: null })),
          AsyncResult.success(new Map()),
        ],
      ],
    });
    const view = registry.get(
      Atom.make((context) =>
        resolveEarnView({
          context,
          entry: classicEntry,
          intent: makeDefaultEarnIntent(),
        })
      )
    );

    expect(view.status).toBe("failed");
    expect(view.failure).toEqual({
      _tag: "ResourceFailure",
      error,
      stage: "token-options",
    });
  });

  it("keeps the previous token options ready after a refresh failure", () => {
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "token-balances-scan",
    });
    const view = resolveClassicView({
      tokenOptionsResult: refreshFailure([tokenOption], error),
    });

    expect(view.status).toBe("ready");
    expect(view.failure).toBeNull();
    expect(view.selection.token).toEqual(tokenOption);
    expect(view.resources.tokenOptions).toMatchObject({
      items: [tokenOption],
      waiting: false,
    });
  });

  it("does not replace an explicit token while token options are still resolving", () => {
    const view = resolveClassicView({
      intent: {
        ...makeDefaultEarnIntent(),
        selectedTokenKey: "ethereum-not-yet-loaded",
      },
      tokenOptionsResult: AsyncResult.waiting(
        AsyncResult.success([tokenOption])
      ),
    });

    expect(view.status).toBe("loading-token-options");
    expect(view.selection.token).toBeNull();
    expect(view.resources.tokenOptions).toMatchObject({
      items: [tokenOption],
      waiting: true,
    });
  });

  it("uses the committed yield as a resource seed after initialization is consumed", () => {
    const selectedYield = yieldApiYieldFixture({
      id: "ethereum-eth-native-staking",
    });
    const selectedToken = {
      ...tokenOption,
      availableYields: [selectedYield.id],
      token: selectedYield.token,
    } satisfies EarnTokenOption;
    const intent = {
      ...makeDefaultEarnIntent(),
      selectedTokenKey: tokenString(selectedToken.token),
      selectedYieldId: selectedYield.id,
    };
    const registry = AtomRegistry.make({
      initialValues: [
        [
          initYieldAtom(new InitYieldKey({ yieldId: selectedYield.id })),
          AsyncResult.success(selectedYield),
        ],
        [
          mergedTokenOptionsAtom(
            new TokenOptionsKey({
              category: null,
              initToken: null,
              initTokenNetwork: null,
              initYieldId: selectedYield.id,
              scope: walletScope,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          AsyncResult.success([selectedToken]),
        ],
        [
          positionsDataAtom(new PositionsDataKey({ scope: walletScope })),
          AsyncResult.success(new Map() as PositionsData),
        ],
        [
          earnYieldCatalogAtom(
            new YieldCatalogKey({
              category: null,
              network: selectedYield.token.network,
              yieldIds: [selectedYield.id],
            })
          ),
          AsyncResult.success([selectedYield]),
        ],
      ],
    });
    const view = registry.get(
      Atom.make((context) =>
        resolveEarnView({
          context,
          entry: { ...entry, dashboardVariant: false, walletScope },
          intent,
        })
      )
    );

    expect(view.status).toBe("ready");
    expect(view.selection.yield).toEqual(selectedYield);
  });

  it("publishes a blocking category discovery failure", () => {
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "available-yield-categories",
    });
    const categoryAtom = availableYieldCategoriesAtom(
      new AvailableYieldCategoriesKey({
        categoryOrder: entry.categoryOrder,
        network: null,
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        [
          initYieldAtom(new InitYieldKey({ yieldId: null })),
          AsyncResult.success(null),
        ],
        [categoryAtom, AsyncResult.failure(Cause.fail(error))],
        [
          positionsDataAtom(new PositionsDataKey({ scope: null })),
          AsyncResult.success(new Map()),
        ],
      ],
    });
    const view = registry.get(
      Atom.make((context) =>
        resolveEarnView({
          context,
          entry,
          intent: makeDefaultEarnIntent(),
        })
      )
    );

    expect(view.status).toBe("failed");
    expect(view.failure).toEqual({
      _tag: "ResourceFailure",
      error,
      stage: "categories",
    });
    expect(view.retryTarget).toEqual({
      _tag: "AvailableCategories",
      key: new AvailableYieldCategoriesKey({
        categoryOrder: entry.categoryOrder,
        network: null,
      }),
    });
  });

  it("distinguishes first yield acquisition failure from no yields", () => {
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "earn-yield-catalog",
    });
    const view = resolveClassicView({
      yieldsResult: AsyncResult.failure(Cause.fail(error)),
    });

    expect(view.status).toBe("failed");
    expect(view.failure).toEqual({
      _tag: "ResourceFailure",
      error,
      stage: "yields",
    });
  });

  it("keeps the previous yields ready after a refresh failure", () => {
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "earn-yield-catalog",
    });
    const view = resolveClassicView({
      yieldsResult: refreshFailure([yieldModel], error),
    });

    expect(view.status).toBe("ready");
    expect(view.failure).toBeNull();
    expect(view.selection.yield).toEqual(yieldModel);
    expect(view.resources.yields).toEqual({
      items: [yieldModel],
      waiting: false,
    });
  });

  it("waits for positions before publishing a connected selection as ready", () => {
    const view = resolveClassicView({
      positionsResult: AsyncResult.initial(true),
    });

    expect(view.status).toBe("loading-positions");
    expect(view.can.submit).toBe(false);
    expect(view.resources.positions.waiting).toBe(true);
  });

  it("publishes a blocking first positions failure", () => {
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "positions-data",
    });
    const view = resolveClassicView({
      positionsResult: AsyncResult.failure(Cause.fail(error)),
    });

    expect(view.status).toBe("failed");
    expect(view.failure).toEqual({
      _tag: "ResourceFailure",
      error,
      stage: "positions",
    });
  });

  it("keeps previous positions usable after a refresh failure", () => {
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "positions-data",
    });
    const positions = new Map() as PositionsData;
    const view = resolveClassicView({
      positionsResult: refreshFailure(positions, error),
    });

    expect(view.status).toBe("ready");
    expect(view.failure).toBeNull();
  });

  it("publishes no validators when a required validator set loads empty", () => {
    const base = yieldApiYieldFixture();
    const requiredYield = {
      ...base,
      mechanics: {
        ...base.mechanics,
        requiresValidatorSelection: true,
      },
    } satisfies EarnYield;
    const requiredToken = {
      ...tokenOption,
      availableYields: [requiredYield.id],
      token: requiredYield.token,
    } satisfies EarnTokenOption;
    const validators = yieldValidatorsAtom(
      new YieldValidatorsKey({
        network: requiredYield.token.network,
        selectedYieldId: requiredYield.id,
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [
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
              scope: walletScope,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          AsyncResult.success([requiredToken]),
        ],
        [
          positionsDataAtom(new PositionsDataKey({ scope: walletScope })),
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
        [validators.initialValidatorsResultAtom, AsyncResult.success([])],
      ],
    });
    const view = registry.get(
      Atom.make((context) =>
        resolveEarnView({
          context,
          entry: { ...entry, dashboardVariant: false, walletScope },
          intent: makeDefaultEarnIntent(),
        })
      )
    );

    expect(view.status).toBe("no-validators");
    expect(view.can.submit).toBe(false);
  });

  it("waits for required validators before publishing readiness", () => {
    const base = yieldApiYieldFixture();
    const requiredYield = {
      ...base,
      mechanics: {
        ...base.mechanics,
        requiresValidatorSelection: true,
      },
    } satisfies EarnYield;
    const requiredToken = {
      ...tokenOption,
      availableYields: [requiredYield.id],
      token: requiredYield.token,
    } satisfies EarnTokenOption;
    const validators = yieldValidatorsAtom(
      new YieldValidatorsKey({
        network: requiredYield.token.network,
        selectedYieldId: requiredYield.id,
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [
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
              scope: walletScope,
              tokensForEnabledYieldsOnly: false,
            })
          ),
          AsyncResult.success([requiredToken]),
        ],
        [
          positionsDataAtom(new PositionsDataKey({ scope: walletScope })),
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
        [validators.initialValidatorsResultAtom, AsyncResult.initial(true)],
      ],
    });
    const view = registry.get(
      Atom.make((context) =>
        resolveEarnView({
          context,
          entry: { ...entry, dashboardVariant: false, walletScope },
          intent: makeDefaultEarnIntent(),
        })
      )
    );

    expect(view.status).toBe("loading-validators");
    expect(view.can.submit).toBe(false);
  });

  it("blocks on first required-validator acquisition failure", () => {
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "validators",
    });
    const view = resolveRequiredValidatorView(
      AsyncResult.failure(Cause.fail(error))
    );

    expect(view.status).toBe("failed");
    expect(view.failure).toEqual({
      _tag: "ResourceFailure",
      error,
      stage: "validators",
    });
  });

  it("keeps previous validators ready after a refresh failure", () => {
    const validator = Schema.decodeSync(EarnValidator)(
      yieldApiValidatorFixture({ address: "0xvalidator" })
    );
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "validators",
    });
    const view = resolveRequiredValidatorView(
      AsyncResult.failure(Cause.fail(error), {
        previousSuccess: Option.some(AsyncResult.success([validator])),
      })
    );

    expect(view.status).toBe("ready");
    expect(view.failure).toBeNull();
    expect(view.selection.validators).toEqual([validator]);
  });
});
