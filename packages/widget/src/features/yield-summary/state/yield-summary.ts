import { Data } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { getYieldProviderYieldIds } from "../../../domain/earn/yield";
import {
  resolveYieldSummaryView,
  type YieldSummaryInput,
} from "../model/yield-summary";
import { MultiYieldsKey, visibleMultiYieldsAtom } from "./multi-yields";

export class YieldSummaryKey extends Data.Class<YieldSummaryInput> {
  constructor(input: YieldSummaryInput) {
    super({
      ...input,
      validators:
        input.validators instanceof Map
          ? [...input.validators.values()]
          : input.validators,
    });
  }
}

export const makeYieldSummary = (inputAtom: Atom.Atom<YieldSummaryInput>) => {
  const providerYieldsResultAtom = Atom.make((get) => {
    const selectedYield = get(inputAtom).yield;
    const yieldIds = selectedYield
      ? getYieldProviderYieldIds(selectedYield)
      : [];
    if (yieldIds.length === 0) return AsyncResult.success(null);

    return get(
      visibleMultiYieldsAtom(
        new MultiYieldsKey({
          yieldIds,
        })
      )
    );
  }).pipe(Atom.withLabel("yieldSummaryProviderYieldsResultAtom"));
  const viewAtom = Atom.make((get) => {
    return resolveYieldSummaryView({
      input: get(inputAtom),
      providerYieldsResult: get(providerYieldsResultAtom),
    });
  }).pipe(Atom.withLabel("yieldSummaryFacadeViewAtom"));

  return { viewAtom } as const;
};

export const yieldSummaryAtom = Atom.family(
  (key: YieldSummaryKey) =>
    makeYieldSummary(Atom.make<YieldSummaryInput>(key)).viewAtom
);
