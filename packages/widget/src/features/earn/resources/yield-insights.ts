import BigNumber from "bignumber.js";
import { Data, Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type {
  HistoryPeriod,
  RewardsAddresses,
  RewardsSummary,
} from "../../../domain/schema/dashboard-models";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type {
  WalletAddress,
  YieldId,
} from "../../../domain/schema/identifiers";
import {
  isKycGateBlocking,
  mapKycStatusToGate,
} from "../../../domain/types/kyc";
import { isValidYieldIdForRewardsSummary } from "../../../domain/types/rewards";
import { LegacyApiService } from "../../../services/api/legacy-api-service";
import { YieldApiService } from "../../../services/api/yield-api-service";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";
import {
  currentWalletStateAtom,
  selectCurrentWalletAtom,
} from "../../wallet/state/selectors";

const dashboardResourcePolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(2),
  revalidateOnMount: true,
});

class YieldKycKey extends Data.Class<{
  readonly address: WalletAddress | null;
  readonly yieldId: YieldId | null;
}> {}

const yieldKycStatusAtom = Atom.family((key: YieldKycKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.address || !key.yieldId) return null;

        const api = yield* YieldApiService;
        return yield* api.getKycStatus({
          address: key.address,
          yieldId: key.yieldId,
        });
      })
    )
    .pipe(dashboardResourcePolicy)
);

class CurrentYieldKycKey extends Data.Class<{
  readonly enabled: boolean;
  readonly kycRequired: boolean;
  readonly yieldId: YieldId | null;
}> {}

const makeCurrentYieldKycResource = (
  wallet: Atom.Type<typeof currentWalletStateAtom>,
  key: CurrentYieldKycKey
) => {
  const queryEnabled =
    key.enabled && key.kycRequired && wallet.status === "connected";

  return yieldKycStatusAtom(
    new YieldKycKey({
      address: queryEnabled ? wallet.address : null,
      yieldId: queryEnabled ? key.yieldId : null,
    })
  );
};

const getCurrentYieldKycResource = (
  get: Atom.AtomContext,
  key: CurrentYieldKycKey
) => makeCurrentYieldKycResource(get(currentWalletStateAtom), key);

const currentYieldKycStatusAtom = Atom.family((key: CurrentYieldKycKey) =>
  Atom.make((get) => get(getCurrentYieldKycResource(get, key)))
);

const currentYieldKycQueryEnabledAtom = Atom.family((key: CurrentYieldKycKey) =>
  Atom.make((get) => {
    const wallet = get(currentWalletStateAtom);

    return (
      key.enabled &&
      key.kycRequired &&
      key.yieldId !== null &&
      wallet.status === "connected"
    );
  })
);

export class CurrentYieldKycGateKey extends Data.Class<{
  readonly enabled: boolean;
  readonly yieldDto: EarnYieldWithProvider | null;
}> {}

const getCurrentYieldKycKey = (key: CurrentYieldKycGateKey) =>
  new CurrentYieldKycKey({
    enabled: key.enabled,
    kycRequired: key.yieldDto?.mechanics.requirements?.kycRequired === true,
    yieldId: key.yieldDto?.id ?? null,
  });

export const refreshCurrentYieldKycAtom = Atom.family(
  (key: CurrentYieldKycGateKey) =>
    Atom.fnSync(
      (_input: undefined, get) =>
        get.refresh(
          makeCurrentYieldKycResource(
            get(currentWalletStateAtom),
            getCurrentYieldKycKey(key)
          )
        ),
      { initialValue: undefined }
    )
);

export const currentYieldKycGateAtom = Atom.family(
  (key: CurrentYieldKycGateKey) =>
    Atom.make((get) => {
      const resourceKey = getCurrentYieldKycKey(key);
      const queryEnabled = get(currentYieldKycQueryEnabledAtom(resourceKey));
      const result = get(currentYieldKycStatusAtom(resourceKey));
      const status = result.pipe(AsyncResult.value, Option.getOrUndefined);
      const isFetching = queryEnabled && result.waiting;
      const gate = !queryEnabled
        ? ({ state: "pass" } as const)
        : AsyncResult.isFailure(result)
          ? mapKycStatusToGate({ status: null, yieldDto: key.yieldDto })
          : mapKycStatusToGate({ status, yieldDto: key.yieldDto });

      return {
        data: status === null ? undefined : status,
        error: result.pipe(AsyncResult.error, Option.getOrUndefined),
        gate,
        isError: AsyncResult.isFailure(result),
        isFetching,
        isGateBlocking:
          queryEnabled &&
          (AsyncResult.isInitial(result) || isKycGateBlocking(gate)),
        isKycEnabled: queryEnabled,
        isLoading: queryEnabled && AsyncResult.isInitial(result),
        isRefetching: isFetching && status !== undefined,
      } as const;
    })
);

export type CurrentYieldKycGate = Atom.Type<
  ReturnType<typeof currentYieldKycGateAtom>
>;

export class YieldHistoryKey extends Data.Class<{
  readonly period: HistoryPeriod;
  readonly yieldId: YieldId | null;
}> {}

const getYieldHistoryInterval = (period: HistoryPeriod) =>
  period === "1y" || period === "all" ? "week" : "day";

export const yieldRewardRateHistoryAtom = Atom.family((key: YieldHistoryKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.yieldId) return null;

        const api = yield* YieldApiService;
        return yield* api.getRewardRateHistory({
          interval: getYieldHistoryInterval(key.period),
          period: key.period,
          yieldId: key.yieldId,
        });
      })
    )
    .pipe(dashboardResourcePolicy)
);

export const yieldTvlHistoryAtom = Atom.family((key: YieldHistoryKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.yieldId) return null;

        const api = yield* YieldApiService;
        return yield* api.getTvlHistory({
          interval: getYieldHistoryInterval(key.period),
          period: key.period,
          yieldId: key.yieldId,
        });
      })
    )
    .pipe(dashboardResourcePolicy)
);

class RewardsSummaryKey extends Data.Class<{
  readonly addresses: RewardsAddresses | null;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {}

const rewardsSummaryAtom = Atom.family((key: RewardsSummaryKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.addresses || key.yieldIds.length === 0) {
          return null;
        }

        const api = yield* LegacyApiService;
        return yield* api.getRewardsSummaries({
          addresses: key.addresses,
          yieldIds: key.yieldIds,
        });
      })
    )
    .pipe(
      withApiResourcePolicy({
        idleTTL: Duration.minutes(5),
        staleTime: Duration.zero,
        revalidateOnMount: true,
      })
    )
);

type RewardsSummaryResult = Record<string, RewardsSummary>;

export class CurrentRewardsSummaryKey extends Data.Class<{
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {
  constructor({ yieldIds }: { readonly yieldIds: ReadonlyArray<YieldId> }) {
    super({ yieldIds: [...new Set(yieldIds)].sort() });
  }
}

const currentRewardsAddressesAtom = selectCurrentWalletAtom((walletState) =>
  walletState.status === "connected"
    ? {
        address: walletState.address,
        ...(walletState.additionalAddresses
          ? { additionalAddresses: walletState.additionalAddresses }
          : {}),
      }
    : null
).pipe(Atom.withLabel("currentRewardsAddressesAtom"));

export const currentRewardsSummaryAtom = Atom.family(
  (key: CurrentRewardsSummaryKey) =>
    Atom.make((get) => {
      const filteredIds = key.yieldIds.filter(isValidYieldIdForRewardsSummary);
      const addresses = get(currentRewardsAddressesAtom);

      return get(
        rewardsSummaryAtom(
          new RewardsSummaryKey({
            addresses,
            yieldIds: filteredIds,
          })
        )
      );
    })
);

export const positiveRewardsSummaryAtom = Atom.family(
  (key: CurrentRewardsSummaryKey) =>
    currentRewardsSummaryAtom(key).pipe(
      Atom.mapResult((summaries) => {
        if (!summaries) return null;

        return key.yieldIds.reduce<RewardsSummaryResult>(
          (positive, yieldId) => {
            const summary = summaries[yieldId];

            if (summary && BigNumber(summary.rewards.total).gt(0)) {
              positive[yieldId] = summary;
            }

            return positive;
          },
          {}
        );
      })
    )
);
