import BigNumber from "bignumber.js";
import { Data, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  HistoryPeriod,
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
import {
  RewardSummariesKey,
  rewardSummariesResourceAtom,
} from "../../../resources/reward-summaries/reward-summaries";
import {
  YieldHistoryResourceKey,
  YieldKycStatusKey,
  yieldKycStatusResourceAtom,
  yieldRewardRateHistoryResourceAtom,
  yieldTvlHistoryResourceAtom,
} from "../../../resources/yield-insights/yield-insights";
import {
  currentWalletStateAtom,
  selectCurrentWalletAtom,
} from "../../wallet/state/selectors";

class YieldKycKey extends Data.Class<{
  readonly address: WalletAddress | null;
  readonly yieldId: YieldId | null;
}> {}

const yieldKycStatusAtom = Atom.family((key: YieldKycKey) =>
  Atom.readable(
    (get) =>
      key.address && key.yieldId
        ? get(
            yieldKycStatusResourceAtom(
              new YieldKycStatusKey({
                address: key.address,
                yieldId: key.yieldId,
              })
            )
          )
        : AsyncResult.success(null),
    (refresh) => {
      if (key.address && key.yieldId) {
        refresh(
          yieldKycStatusResourceAtom(
            new YieldKycStatusKey({
              address: key.address,
              yieldId: key.yieldId,
            })
          )
        );
      }
    }
  )
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
      const getGate = () => {
        if (!queryEnabled) return { state: "pass" } as const;
        if (AsyncResult.isFailure(result)) {
          return mapKycStatusToGate({
            status: null,
            yieldDto: key.yieldDto,
          });
        }
        return mapKycStatusToGate({ status, yieldDto: key.yieldDto });
      };
      const gate = getGate();

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
  Atom.make((get) =>
    key.yieldId
      ? get(
          yieldRewardRateHistoryResourceAtom(
            new YieldHistoryResourceKey({
              interval: getYieldHistoryInterval(key.period),
              period: key.period,
              yieldId: key.yieldId,
            })
          )
        )
      : AsyncResult.success(null)
  )
);

export const yieldTvlHistoryAtom = Atom.family((key: YieldHistoryKey) =>
  Atom.make((get) =>
    key.yieldId
      ? get(
          yieldTvlHistoryResourceAtom(
            new YieldHistoryResourceKey({
              interval: getYieldHistoryInterval(key.period),
              period: key.period,
              yieldId: key.yieldId,
            })
          )
        )
      : AsyncResult.success(null)
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

      return addresses && filteredIds.length > 0
        ? get(
            rewardSummariesResourceAtom(
              new RewardSummariesKey({
                addresses,
                yieldIds: filteredIds,
              })
            )
          )
        : AsyncResult.success(null);
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
