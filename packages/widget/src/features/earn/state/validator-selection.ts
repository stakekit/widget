import { Effect, Match } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type {
  EarnValidator,
  EarnValidatorKey,
} from "../../../domain/earn/models";
import { exactZero } from "../../../domain/finance/exact";
import { widgetConfigAtom } from "../../../features/widget-configuration/index";
import { TrackingService } from "../../../services/tracking/tracking-service";
import {
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  earnSelectionValidatorOptionsViewAtom,
  earnSelectionYieldOptionsViewAtom,
  loadMoreEarnSelectionValidatorsAtom,
  removeEarnSelectionValidatorAtom,
  selectEarnSelectionValidatorAtom,
  setEarnSelectionValidatorSearchAtom,
} from "./earn-selection";
import { earnAppLoadingAtom } from "./page-status";
import { earnPageSelectionAtom } from "./page-workflow";

export const selectedEarnValidatorsAtom = Atom.make(
  (get) =>
    new Map(
      get(earnPageSelectionAtom).validators.map((validator) => [
        validator.key,
        validator,
      ])
    )
).pipe(Atom.withLabel("selectedEarnValidatorsAtom"));

const resolveValidatorsData = ({
  enabled,
  shouldSort,
  validators,
}: {
  readonly enabled: boolean;
  readonly shouldSort: boolean;
  readonly validators: ReadonlyArray<EarnValidator>;
}) => {
  if (!enabled) return null;
  if (!shouldSort) return [...validators];
  return [...validators].sort(
    (left, right) =>
      (right.rewardRate?.total ?? exactZero()).comparedTo(
        left.rewardRate?.total ?? exactZero()
      ) ?? 0
  );
};

export const earnValidatorSelectionViewAtom = Atom.make((get) => {
  const config = get(widgetConfigAtom);
  const status = get(earnSelectionStatusViewAtom);
  const tokenOptions = get(earnSelectionTokenOptionsViewAtom);
  const validatorOptions = get(earnSelectionValidatorOptionsViewAtom);
  const yieldOptions = get(earnSelectionYieldOptionsViewAtom);
  const data = resolveValidatorsData({
    enabled: Boolean(
      validatorOptions.selectedYield && validatorOptions.enabled
    ),
    shouldSort:
      Boolean(config.dashboardVariant) ||
      config.variant === "utila" ||
      config.variant === "porto",
    validators: validatorOptions.items,
  });
  const tokenOptionsLoading =
    tokenOptions.waiting && tokenOptions.items.length === 0;
  const yieldLoading = status.loading.yields || yieldOptions.waiting;

  return {
    data,
    hasMore: validatorOptions.page.hasMore,
    isDebouncing: validatorOptions.isDebouncing,
    isLoading:
      get(earnAppLoadingAtom).isLoading ||
      tokenOptionsLoading ||
      yieldLoading ||
      validatorOptions.isDebouncing ||
      (validatorOptions.enabled && validatorOptions.page.isLoadingFirstPage),
    isLoadingMore: validatorOptions.page.isLoadingMore,
    search: validatorOptions.search,
    selected: get(selectedEarnValidatorsAtom),
    selectedYield: validatorOptions.selectedYield,
  } as const;
}).pipe(Atom.withLabel("earnValidatorSelectionViewAtom"));

type EarnValidatorModalEvent =
  | Readonly<{ readonly _tag: "Opened" }>
  | Readonly<{ readonly _tag: "Closed" }>
  | Readonly<{ readonly _tag: "ViewMoreClicked" }>;

export const earnValidatorModalEventAtom = appRuntime
  .fn((event: EarnValidatorModalEvent) => {
    const trackingEvent = Match.value(event).pipe(
      Match.tag("Opened", () => "selectValidatorModalOpened" as const),
      Match.tag("Closed", () => "selectValidatorModalClosed" as const),
      Match.tag(
        "ViewMoreClicked",
        () => "selectValidatorViewMoreClicked" as const
      ),
      Match.exhaustive
    );
    return TrackingService.use((tracking) =>
      tracking.trackEvent(trackingEvent)
    );
  })
  .pipe(Atom.withLabel("earnValidatorModalEventAtom"));

export const setEarnValidatorSearchAtom = setEarnSelectionValidatorSearchAtom;

export const selectEarnValidatorAtom = appRuntime
  .fn((validatorKey: EarnValidatorKey, context) => {
    const view = context(earnSelectionValidatorOptionsViewAtom);
    const validator = view.items.find(
      (candidate) => candidate.key === validatorKey
    );
    if (!view.selectedYield || !validator) return Effect.void;
    context.set(selectEarnSelectionValidatorAtom, validator.key);
    return TrackingService.use((tracking) =>
      tracking.trackEvent("validatorSelected", {
        validatorName: validator.name,
        validatorAddress: validator.address,
      })
    );
  })
  .pipe(Atom.withLabel("selectEarnValidatorAtom"));

export const removeEarnValidatorAtom = appRuntime
  .fn((validatorKey: EarnValidatorKey, context) => {
    const view = context(earnSelectionValidatorOptionsViewAtom);
    const validator = [...view.selected, ...view.items].find(
      (candidate) => candidate.key === validatorKey
    );
    if (!validator) return Effect.void;
    context.set(removeEarnSelectionValidatorAtom, validatorKey);
    return TrackingService.use((tracking) =>
      tracking.trackEvent("validatorRemoved", {
        validatorName: validator.name,
        validatorAddress: validator.address,
      })
    );
  })
  .pipe(Atom.withLabel("removeEarnValidatorAtom"));

export const loadMoreEarnValidatorsAtom = loadMoreEarnSelectionValidatorsAtom;
