import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { YieldAction } from "../../domain/schema/action-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../domain/schema/earn-models";

type ActivitySelection = {
  selectedAction: YieldAction;
  selectedYield: EarnYieldWithProvider;
  selectedValidators: ReadonlyArray<EarnValidator>;
};

type ActivitySelectionState = ActivitySelection | null;

const activitySelectionAtom = Atom.make<ActivitySelectionState>(null).pipe(
  Atom.keepAlive,
  Atom.withLabel("activitySelectionAtom")
);

const useActivitySelection = () => useAtomValue(activitySelectionAtom);

export const useActivitySelectedAction = () =>
  useActivitySelection()?.selectedAction ?? null;

export const useActivitySelectedYield = () =>
  useActivitySelection()?.selectedYield ?? null;

export const useActivitySelectedValidators = () =>
  useActivitySelection()?.selectedValidators ?? null;

export const useSetActivitySelection = () => useAtomSet(activitySelectionAtom);
