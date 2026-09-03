import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { tokenString } from "../../../domain/token/token";
import { TrackingService } from "../../../services/tracking/tracking-service";
import {
  type EarnTokenOption,
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  selectEarnSelectionTokenAtom,
} from "./earn-selection";
import { earnPageSearchAtom } from "./page-workflow";

export const earnTokenSelectionViewAtom = Atom.make((get) => {
  const options = get(earnSelectionTokenOptionsViewAtom);
  const status = get(earnSelectionStatusViewAtom);
  const search = get(earnPageSearchAtom).token;
  const all = [...options.items];
  const normalizedSearch = search.toLowerCase();
  const filtered = normalizedSearch
    ? all.filter(
        (option) =>
          option.token.name.toLowerCase().includes(normalizedSearch) ||
          option.token.symbol.toLowerCase().includes(normalizedSearch)
      )
    : all;
  const loading =
    status.loading.wallet ||
    status.loading.tokens ||
    status.loading.initialSelection ||
    (options.waiting && all.length === 0);

  return {
    all,
    filtered,
    isLoading: loading,
    search,
    selected: options.selected,
  } as const;
}).pipe(Atom.withLabel("earnTokenSelectionViewAtom"));

export const setEarnTokenSearchAtom = Atom.fnSync((token: string, context) => {
  const search = context(earnPageSearchAtom);
  context.set(earnPageSearchAtom, { ...search, token });
}).pipe(Atom.withLabel("setEarnTokenSearchAtom"));

export const selectEarnTokenAtom = appRuntime
  .fn((token: EarnTokenOption, context) => {
    context.set(selectEarnSelectionTokenAtom, tokenString(token.token));
    return TrackingService.use((tracking) =>
      tracking.trackEvent("tokenSelected", { token: token.token.symbol })
    );
  })
  .pipe(Atom.withLabel("selectEarnTokenAtom"));
