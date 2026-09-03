import { useAtomValue } from "@effect/atom-react";
import { mountRevealReadyAtom } from "../state/reveal-gate";

export const useMountRevealReady = () => useAtomValue(mountRevealReadyAtom);
