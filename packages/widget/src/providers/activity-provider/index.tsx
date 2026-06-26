import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { Maybe } from "purify-ts";
import type { ActionDto } from "../../domain/types/action";
import type { Yield } from "../../domain/types/yields";
import type { ValidatorDto } from "../../generated/api/yield";

type ActivitySelection = {
  selectedAction: ActionDto;
  selectedYield: Yield;
  selectedValidators: ValidatorDto[];
};

type ActivitySelectionState = Maybe<ActivitySelection>;

const activitySelectionAtom = Atom.make<ActivitySelectionState>(
  Maybe.empty()
).pipe(Atom.keepAlive, Atom.withLabel("activitySelectionAtom"));

const useActivitySelection = () => useAtomValue(activitySelectionAtom);

export const useActivitySelectedAction = () =>
  useActivitySelection().map(({ selectedAction }) => selectedAction);

export const useActivitySelectedYield = () =>
  useActivitySelection().map(({ selectedYield }) => selectedYield);

export const useActivitySelectedValidators = () =>
  useActivitySelection().map(({ selectedValidators }) => selectedValidators);

export const useSetActivitySelection = () => useAtomSet(activitySelectionAtom);
