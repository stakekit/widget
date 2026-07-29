import { Option, Schema } from "effect";
import type {
  BorrowAccountSnapshot,
  DebtBalance,
  IsolatedRiskSnapshot,
  SupplyBalance,
} from "./borrow-account-snapshot";
import { decodeTokenId, MarketId, TokenId } from "./ids";
import type { Market } from "./market";
import { NonNegativeFinite } from "./risk-values";

type RiskUnavailableReason =
  | "conflictingParameters"
  | "conflictingCollateralTotal"
  | "conflictingPositionState"
  | "invalidAmount"
  | "missingParameters"
  | "missingPositionState"
  | "missingPrice"
  | "unknownCollateral"
  | "unknownMarket";

type AvailableRiskProjection = {
  readonly borrowCapacityUsd: number;
  readonly healthFactor: number | null;
  readonly liquidationCapacityUsd: number;
  readonly liquidationThreshold: number | null;
  readonly ltv: number;
  readonly maxLtv: number | null;
  readonly status: "available";
  readonly totalCollateralUsd: number;
  readonly totalDebtUsd: number;
};

type UnavailableRiskProjection = {
  readonly reason: RiskUnavailableReason;
  readonly status: "unavailable";
  readonly totalCollateralUsd: number | null;
  readonly totalDebtUsd: number | null;
};

type RiskProjection = AvailableRiskProjection | UnavailableRiskProjection;

const RiskChangeSchema = Schema.Union([
  Schema.Struct({
    amount: NonNegativeFinite,
    marketId: MarketId,
    type: Schema.Literals(["borrow", "repay"]),
  }),
  Schema.Struct({
    amount: NonNegativeFinite,
    tokenId: TokenId,
    type: Schema.Literals(["supply", "withdraw"]),
  }),
  Schema.Struct({
    tokenId: TokenId,
    type: Schema.Literals(["disableCollateral", "enableCollateral"]),
  }),
]);

export type RiskChange = typeof RiskChangeSchema.Type;

type RiskAssessment =
  | {
      readonly decision: "allow";
      readonly projection: RiskProjection;
    }
  | {
      readonly decision: "block";
      readonly projection: AvailableRiskProjection;
      readonly reason: "borrowCapacityExceeded";
    };

export type RiskPosition = {
  readonly assess: (changes: ReadonlyArray<RiskChange>) => RiskAssessment;
  readonly current: RiskProjection;
  readonly scope: "account" | "market";
};

type CollateralDefinition = {
  readonly liquidationThreshold: number;
  readonly maxLtv: number;
  readonly priceUsd: number;
  readonly tokenId: TokenId;
};

type CollateralExposure = CollateralDefinition & {
  readonly collateralUsd: number;
  readonly enabled: boolean;
};

type RiskState = {
  readonly collateral: ReadonlyArray<CollateralExposure>;
  readonly debtUsd: number;
};

const decodeChanges = Schema.decodeUnknownOption(
  Schema.Array(RiskChangeSchema)
);
const decodeRiskAmount = Schema.decodeUnknownOption(NonNegativeFinite);

const unavailable = ({
  reason,
  totalCollateralUsd,
  totalDebtUsd,
}: {
  readonly reason: RiskUnavailableReason;
  readonly totalCollateralUsd: number | null;
  readonly totalDebtUsd: number | null;
}): UnavailableRiskProjection => ({
  reason,
  status: "unavailable",
  totalCollateralUsd,
  totalDebtUsd,
});

const projectState = (state: RiskState): RiskProjection => {
  const enabledCollateral = state.collateral.filter((item) => item.enabled);
  const totals = enabledCollateral.reduce(
    (result, item) => ({
      borrowCapacityUsd:
        result.borrowCapacityUsd + item.collateralUsd * item.maxLtv,
      liquidationCapacityUsd:
        result.liquidationCapacityUsd +
        item.collateralUsd * item.liquidationThreshold,
      totalCollateralUsd: result.totalCollateralUsd + item.collateralUsd,
    }),
    {
      borrowCapacityUsd: 0,
      liquidationCapacityUsd: 0,
      totalCollateralUsd: 0,
    }
  );
  const decodedTotals = [
    decodeRiskAmount(totals.borrowCapacityUsd),
    decodeRiskAmount(totals.liquidationCapacityUsd),
    decodeRiskAmount(totals.totalCollateralUsd),
    decodeRiskAmount(state.debtUsd),
  ];

  if (decodedTotals.some(Option.isNone)) {
    return unavailable({
      reason: "invalidAmount",
      totalCollateralUsd: null,
      totalDebtUsd: null,
    });
  }

  const hasCollateral = totals.totalCollateralUsd > 0;
  const ltv = (() => {
    if (hasCollateral) {
      return state.debtUsd / totals.totalCollateralUsd;
    }

    return state.debtUsd > 0 ? 1 : 0;
  })();

  return {
    ...totals,
    healthFactor:
      state.debtUsd > 0 ? totals.liquidationCapacityUsd / state.debtUsd : null,
    liquidationThreshold: hasCollateral
      ? totals.liquidationCapacityUsd / totals.totalCollateralUsd
      : null,
    ltv,
    maxLtv: hasCollateral
      ? totals.borrowCapacityUsd / totals.totalCollateralUsd
      : null,
    status: "available",
    totalDebtUsd: state.debtUsd,
  };
};

const collateralTotalMatchesSnapshot = ({
  compositionTotalUsd,
  snapshotTotalUsd,
}: {
  readonly compositionTotalUsd: number;
  readonly snapshotTotalUsd: number;
}) => {
  const tolerance = Math.max(0.01, snapshotTotalUsd * 0.000_001);

  return Math.abs(compositionTotalUsd - snapshotTotalUsd) <= tolerance;
};

const getDefinitions = (
  markets: ReadonlyArray<Market>
):
  | {
      readonly definitions: ReadonlyMap<TokenId, CollateralDefinition>;
      readonly status: "available";
    }
  | {
      readonly reason: RiskUnavailableReason;
      readonly status: "unavailable";
    } => {
  const definitions = new Map<TokenId, CollateralDefinition>();

  for (const market of markets) {
    for (const collateralToken of market.collateralTokens) {
      const tokenId = decodeTokenId({
        address: collateralToken.token.address,
        symbol: collateralToken.token.symbol,
      });
      const previous = definitions.get(tokenId);
      const definition = {
        liquidationThreshold: collateralToken.liquidationThreshold,
        maxLtv: collateralToken.maxLtv,
        priceUsd: collateralToken.priceUsd,
        tokenId,
      };

      if (
        previous &&
        (previous.liquidationThreshold !== definition.liquidationThreshold ||
          previous.maxLtv !== definition.maxLtv ||
          previous.priceUsd !== definition.priceUsd)
      ) {
        return { reason: "conflictingParameters", status: "unavailable" };
      }

      definitions.set(tokenId, definition);
    }
  }

  return { definitions, status: "available" };
};

const getCollateralState = ({
  definitions,
  supplyBalances,
}: {
  readonly definitions: ReadonlyMap<TokenId, CollateralDefinition>;
  readonly supplyBalances: ReadonlyArray<SupplyBalance>;
}):
  | {
      readonly collateral: ReadonlyArray<CollateralExposure>;
      readonly status: "available";
    }
  | {
      readonly reason: RiskUnavailableReason;
      readonly status: "unavailable";
    } => {
  const collateral: CollateralExposure[] = [];

  for (const supplyBalance of supplyBalances) {
    const tokenId = decodeTokenId({
      address: supplyBalance.tokenAddress,
      symbol: supplyBalance.tokenSymbol,
    });
    const definition = definitions.get(tokenId);

    if (!definition) {
      if (supplyBalance.isCollateral) {
        return { reason: "missingParameters", status: "unavailable" };
      }
      continue;
    }

    if (
      supplyBalance.balance > 0 &&
      (definition.priceUsd <= 0 || supplyBalance.balanceUsd <= 0)
    ) {
      return { reason: "missingPrice", status: "unavailable" };
    }

    collateral.push({
      ...definition,
      collateralUsd: supplyBalance.balanceUsd,
      enabled: supplyBalance.isCollateral,
    });
  }

  return { collateral, status: "available" };
};

type RiskStateResult =
  | {
      readonly state: RiskState;
      readonly status: "available";
    }
  | {
      readonly reason: RiskUnavailableReason;
      readonly status: "unavailable";
    };

const applyChange = ({
  change,
  collateralDefinitions,
  loanPrices,
  state,
}: {
  readonly change: RiskChange;
  readonly collateralDefinitions: ReadonlyMap<TokenId, CollateralDefinition>;
  readonly loanPrices: ReadonlyMap<MarketId, number>;
  readonly state: RiskState;
}): RiskStateResult => {
  switch (change.type) {
    case "borrow":
    case "repay": {
      const priceUsd = loanPrices.get(change.marketId);
      if (priceUsd == null) {
        return { reason: "unknownMarket", status: "unavailable" };
      }
      if (priceUsd <= 0) {
        return { reason: "missingPrice", status: "unavailable" };
      }
      const debtUsdChange = change.amount * priceUsd;

      return {
        state: {
          ...state,
          debtUsd:
            change.type === "borrow"
              ? state.debtUsd + debtUsdChange
              : Math.max(state.debtUsd - debtUsdChange, 0),
        },
        status: "available",
      };
    }
    case "supply":
    case "withdraw": {
      const definition = collateralDefinitions.get(change.tokenId);
      if (!definition) {
        return { reason: "unknownCollateral", status: "unavailable" };
      }
      if (definition.priceUsd <= 0) {
        return { reason: "missingPrice", status: "unavailable" };
      }
      const collateralUsdChange = change.amount * definition.priceUsd;
      const existing = state.collateral.find(
        (item) => item.tokenId === change.tokenId
      );

      if (!existing && change.type === "withdraw") {
        return { reason: "unknownCollateral", status: "unavailable" };
      }

      if (!existing) {
        return {
          state: {
            ...state,
            collateral: [
              ...state.collateral,
              {
                ...definition,
                collateralUsd: collateralUsdChange,
                enabled: true,
              },
            ],
          },
          status: "available",
        };
      }

      const collateralUsd =
        change.type === "supply"
          ? existing.collateralUsd + collateralUsdChange
          : Math.max(existing.collateralUsd - collateralUsdChange, 0);

      return {
        state: {
          ...state,
          collateral: state.collateral.map((item) =>
            item.tokenId === change.tokenId ? { ...item, collateralUsd } : item
          ),
        },
        status: "available",
      };
    }
    case "disableCollateral":
    case "enableCollateral": {
      const existing = state.collateral.find(
        (item) => item.tokenId === change.tokenId
      );
      if (!existing) {
        return { reason: "unknownCollateral", status: "unavailable" };
      }

      return {
        state: {
          ...state,
          collateral: state.collateral.map((item) =>
            item.tokenId === change.tokenId
              ? {
                  ...item,
                  enabled: change.type === "enableCollateral",
                }
              : item
          ),
        },
        status: "available",
      };
    }
  }
};

const applyChanges = ({
  changes,
  collateralDefinitions,
  loanPrices,
  state,
}: {
  readonly changes: ReadonlyArray<RiskChange>;
  readonly collateralDefinitions: ReadonlyMap<TokenId, CollateralDefinition>;
  readonly loanPrices: ReadonlyMap<MarketId, number>;
  readonly state: RiskState;
}): RiskStateResult =>
  changes.reduce<RiskStateResult>(
    (result, change) => {
      if (result.status === "unavailable") {
        return result;
      }

      return applyChange({
        change,
        collateralDefinitions,
        loanPrices,
        state: result.state,
      });
    },
    {
      state,
      status: "available",
    }
  );

const makeRiskPosition = ({
  current,
  definitions,
  loanPrices,
  scope,
  state,
}: {
  readonly current: RiskProjection;
  readonly definitions: ReadonlyMap<TokenId, CollateralDefinition>;
  readonly loanPrices: ReadonlyMap<MarketId, number>;
  readonly scope: RiskPosition["scope"];
  readonly state: RiskState;
}): RiskPosition => ({
  assess: (changes) => {
    const decodedChanges = decodeChanges(changes);
    if (Option.isNone(decodedChanges)) {
      return {
        decision: "allow",
        projection: unavailable({
          reason: "invalidAmount",
          totalCollateralUsd: current.totalCollateralUsd,
          totalDebtUsd: current.totalDebtUsd,
        }),
      };
    }

    if (current.status === "unavailable") {
      return {
        decision: "allow",
        projection: current,
      };
    }

    const changed = applyChanges({
      changes,
      collateralDefinitions: definitions,
      loanPrices,
      state,
    });
    if (changed.status === "unavailable") {
      return {
        decision: "allow",
        projection: unavailable({
          reason: changed.reason,
          totalCollateralUsd: null,
          totalDebtUsd: null,
        }),
      };
    }

    const baseline = projectState(state);
    const projection = projectState(changed.state);
    const riskIncreasing =
      baseline.status === "available" &&
      projection.status === "available" &&
      (projection.totalDebtUsd > baseline.totalDebtUsd ||
        projection.borrowCapacityUsd < baseline.borrowCapacityUsd);

    return projection.status === "available" &&
      riskIncreasing &&
      projection.totalDebtUsd > projection.borrowCapacityUsd
      ? {
          decision: "block",
          projection,
          reason: "borrowCapacityExceeded",
        }
      : { decision: "allow", projection };
  },
  current,
  scope,
});

const makeLoanPrices = (markets: ReadonlyArray<Market>) =>
  new Map(markets.map((market) => [market.id, market.loanTokenPriceUsd]));

const makeAuthoritativeAccountCurrent = ({
  local,
  snapshot,
}: {
  readonly local: AvailableRiskProjection;
  readonly snapshot: BorrowAccountSnapshot;
}): AvailableRiskProjection => {
  const borrowCapacityUsd =
    snapshot.availableToBorrowUsd == null
      ? local.borrowCapacityUsd
      : snapshot.totalBorrowedUsd + snapshot.availableToBorrowUsd;
  const liquidationCapacityUsd =
    snapshot.healthFactor == null || snapshot.totalBorrowedUsd === 0
      ? local.liquidationCapacityUsd
      : snapshot.healthFactor * snapshot.totalBorrowedUsd;

  return {
    borrowCapacityUsd,
    healthFactor: snapshot.healthFactor,
    liquidationCapacityUsd,
    liquidationThreshold:
      snapshot.totalCollateralUsd > 0
        ? liquidationCapacityUsd / snapshot.totalCollateralUsd
        : null,
    ltv: snapshot.currentLtv,
    maxLtv:
      snapshot.totalCollateralUsd > 0
        ? borrowCapacityUsd / snapshot.totalCollateralUsd
        : null,
    status: "available",
    totalCollateralUsd: snapshot.totalCollateralUsd,
    totalDebtUsd: snapshot.totalBorrowedUsd,
  };
};

export const makeAccountRiskPosition = ({
  markets,
  snapshot,
}: {
  readonly markets: ReadonlyArray<Market>;
  readonly snapshot: BorrowAccountSnapshot | null;
}): RiskPosition => {
  const definitionsResult = getDefinitions(markets);
  const totalCollateralUsd = snapshot?.totalCollateralUsd ?? 0;
  const totalDebtUsd = snapshot?.totalBorrowedUsd ?? 0;

  if (definitionsResult.status === "unavailable") {
    return makeRiskPosition({
      current: unavailable({
        reason: definitionsResult.reason,
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: new Map(),
      loanPrices: makeLoanPrices(markets),
      scope: "account",
      state: { collateral: [], debtUsd: totalDebtUsd },
    });
  }

  const collateralResult = getCollateralState({
    definitions: definitionsResult.definitions,
    supplyBalances: snapshot?.supplyBalances ?? [],
  });
  if (collateralResult.status === "unavailable") {
    return makeRiskPosition({
      current: unavailable({
        reason: collateralResult.reason,
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: definitionsResult.definitions,
      loanPrices: makeLoanPrices(markets),
      scope: "account",
      state: { collateral: [], debtUsd: totalDebtUsd },
    });
  }

  const state = {
    collateral: collateralResult.collateral,
    debtUsd: totalDebtUsd,
  };
  const local = projectState(state);
  if (
    snapshot &&
    local.status === "available" &&
    !collateralTotalMatchesSnapshot({
      compositionTotalUsd: local.totalCollateralUsd,
      snapshotTotalUsd: snapshot.totalCollateralUsd,
    })
  ) {
    return makeRiskPosition({
      current: unavailable({
        reason: "conflictingCollateralTotal",
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: definitionsResult.definitions,
      loanPrices: makeLoanPrices(markets),
      scope: "account",
      state,
    });
  }
  const current =
    snapshot && local.status === "available"
      ? makeAuthoritativeAccountCurrent({ local, snapshot })
      : local;

  return makeRiskPosition({
    current,
    definitions: definitionsResult.definitions,
    loanPrices: makeLoanPrices(markets),
    scope: "account",
    state,
  });
};

const makeAuthoritativeMarketCurrent = ({
  local,
  positionState,
}: {
  readonly local: AvailableRiskProjection;
  readonly positionState: IsolatedRiskSnapshot;
}): AvailableRiskProjection => {
  const borrowCapacityUsd =
    local.totalDebtUsd + positionState.availableToBorrowUsd;
  const liquidationCapacityUsd =
    positionState.healthFactor == null || local.totalDebtUsd === 0
      ? local.liquidationCapacityUsd
      : positionState.healthFactor * local.totalDebtUsd;

  return {
    ...local,
    borrowCapacityUsd,
    healthFactor: positionState.healthFactor,
    liquidationCapacityUsd,
    liquidationThreshold: positionState.liquidationThreshold,
    ltv: positionState.currentLtv,
    maxLtv:
      local.totalCollateralUsd > 0
        ? borrowCapacityUsd / local.totalCollateralUsd
        : null,
  };
};

const getIsolatedPositionState = (
  supplyBalances: ReadonlyArray<SupplyBalance>
):
  | {
      readonly positionState: IsolatedRiskSnapshot | null;
      readonly status: "available";
    }
  | {
      readonly reason: "conflictingPositionState";
      readonly status: "unavailable";
    } => {
  const positionStates = supplyBalances.flatMap((balance) =>
    balance.positionState ? [balance.positionState] : []
  );
  const first = positionStates[0] ?? null;
  const hasConflict =
    first !== null &&
    positionStates.some(
      (candidate) =>
        candidate.availableToBorrowUsd !== first.availableToBorrowUsd ||
        candidate.currentLtv !== first.currentLtv ||
        candidate.healthFactor !== first.healthFactor ||
        candidate.liquidationThreshold !== first.liquidationThreshold
    );

  return hasConflict
    ? { reason: "conflictingPositionState", status: "unavailable" }
    : { positionState: first, status: "available" };
};

export const makeMarketRiskPosition = ({
  debtBalance,
  market,
  supplyBalances,
}: {
  readonly debtBalance: DebtBalance | null;
  readonly market: Market;
  readonly supplyBalances: ReadonlyArray<SupplyBalance>;
}): RiskPosition => {
  const definitionsResult = getDefinitions([market]);
  const totalCollateralUsd = supplyBalances
    .filter((balance) => balance.isCollateral)
    .reduce((total, balance) => total + balance.balanceUsd, 0);
  const totalDebtUsd = debtBalance?.balanceUsd ?? 0;
  const loanPrices = makeLoanPrices([market]);

  if (definitionsResult.status === "unavailable") {
    return makeRiskPosition({
      current: unavailable({
        reason: definitionsResult.reason,
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: new Map(),
      loanPrices,
      scope: "market",
      state: { collateral: [], debtUsd: totalDebtUsd },
    });
  }

  const collateralResult = getCollateralState({
    definitions: definitionsResult.definitions,
    supplyBalances,
  });
  if (collateralResult.status === "unavailable") {
    return makeRiskPosition({
      current: unavailable({
        reason: collateralResult.reason,
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: definitionsResult.definitions,
      loanPrices,
      scope: "market",
      state: { collateral: [], debtUsd: totalDebtUsd },
    });
  }

  const state = {
    collateral: collateralResult.collateral,
    debtUsd: totalDebtUsd,
  };
  const local = projectState(state);
  const positionStateResult = getIsolatedPositionState(supplyBalances);
  if (positionStateResult.status === "unavailable") {
    return makeRiskPosition({
      current: unavailable({
        reason: positionStateResult.reason,
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: definitionsResult.definitions,
      loanPrices,
      scope: "market",
      state,
    });
  }
  const { positionState } = positionStateResult;
  const hasExposure =
    supplyBalances.some((supplyBalance) => supplyBalance.balance > 0) ||
    (debtBalance?.balance ?? 0) > 0;
  const current = (() => {
    if (local.status === "available" && positionState) {
      return makeAuthoritativeMarketCurrent({ local, positionState });
    }

    if (hasExposure && !positionState) {
      return unavailable({
        reason: "missingPositionState",
        totalCollateralUsd,
        totalDebtUsd,
      });
    }

    return local;
  })();

  return makeRiskPosition({
    current,
    definitions: definitionsResult.definitions,
    loanPrices,
    scope: "market",
    state,
  });
};
