import { Effect, Match } from "effect";
import * as Atom from "effect/reactivity/Atom";

import type {
  EarnValidator,
  EarnValidatorKey,
} from "../../../domain/earn/validator";
import {
  rankedByRewardRate,
  type ValidatorsConfig,
} from "../../../domain/earn/yield";
import type { Network } from "../../../domain/network/network";
import { appRuntime } from "../../../runtime/app-runtime";
import { widgetConfigAtom } from "../../../runtime/widget-config";
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
  byRewardRate,
  network,
  validators,
  validatorsConfig,
}: {
  readonly byRewardRate: boolean;
  readonly network: Network | null;
  readonly validators: ReadonlyArray<EarnValidator>;
  readonly validatorsConfig: ValidatorsConfig;
}) => {
  if (!network) return null;
  if (!byRewardRate) return [...validators];
  return rankedByRewardRate({ network, validators, validatorsConfig });
};

export const earnValidatorSelectionViewAtom = Atom.make((get) => {
  const config = get(widgetConfigAtom);
  const status = get(earnSelectionStatusViewAtom);
  const tokenOptions = get(earnSelectionTokenOptionsViewAtom);
  const validatorOptions = get(earnSelectionValidatorOptionsViewAtom);
  const yieldOptions = get(earnSelectionYieldOptionsViewAtom);
  const data = resolveValidatorsData({
    byRewardRate: config.hostProfile.earnPresentation.condensed,
    network: validatorOptions.enabled
      ? (validatorOptions.selectedYield?.token.network ?? null)
      : null,
    validators: validatorOptions.items,
    validatorsConfig: config.validatorsConfig,
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
