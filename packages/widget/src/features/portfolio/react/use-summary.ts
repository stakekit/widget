import { useAtomValue } from "@effect/atom-react";
import { summaryViewAtom } from "../state/read-models/summary";

export const useSummary = () => useAtomValue(summaryViewAtom);
