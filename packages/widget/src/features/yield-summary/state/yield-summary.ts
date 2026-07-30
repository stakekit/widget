import { Data } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { getYieldProviderYieldIds } from "../../../domain/types/yields";
import {
  resolveYieldSummaryView,
  type YieldSummaryInput,
} from "../model/yield-summary";
import { MultiYieldsKey, visibleMultiYieldsAtom } from "./multi-yields";

export type {
  YieldSummaryProvider,
  YieldSummaryRewardToken,
} from "../model/yield-summary";

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
    return get(
      visibleMultiYieldsAtom(
        new MultiYieldsKey({
          yieldIds: selectedYield
            ? getYieldProviderYieldIds(selectedYield)
            : [],
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
