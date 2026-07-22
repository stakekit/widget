import { useAtomValue } from "@effect/atom-react";
import {
  currentGroupedPositionsAtom,
  type PositionsListRow,
} from "../../../../resources/positions";

export const useGroupedPositions = (): PositionsListRow[] =>
  useAtomValue(currentGroupedPositionsAtom);
