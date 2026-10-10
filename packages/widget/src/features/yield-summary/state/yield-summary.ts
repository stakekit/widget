import { Data } from "effect";
import * as Atom from "effect/reactivity/Atom";
import {
  resolveYieldSummaryView,
  type YieldSummaryInput,
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
  const viewAtom = Atom.make((get) =>
    resolveYieldSummaryView(get(inputAtom))
  ).pipe(Atom.withLabel("yieldSummaryFacadeViewAtom"));

  return { viewAtom } as const;
};

export const yieldSummaryAtom = Atom.family(
  (key: YieldSummaryKey) =>
    makeYieldSummary(Atom.make<YieldSummaryInput>(key)).viewAtom
);
