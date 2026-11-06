import { useAtomValue } from "@effect/atom-react";
import { manageSummaryAtom } from "../state/read-models/summary";

export const useSummary = () => useAtomValue(manageSummaryAtom);
