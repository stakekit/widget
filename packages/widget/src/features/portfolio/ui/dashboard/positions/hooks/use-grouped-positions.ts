import { useAtomValue } from "@effect/atom-react";
import {
  currentGroupedPositionsAtom,
  type PositionsListRow,
} from "../../../../state/read-models/positions";

export const useGroupedPositions = (): PositionsListRow[] =>
  useAtomValue(currentGroupedPositionsAtom);
