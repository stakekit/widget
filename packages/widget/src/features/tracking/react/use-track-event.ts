import { useAtomSet } from "@effect/atom-react";
import type {
  Properties,
  TrackEventKey,
} from "../../../services/tracking/types";
import { trackEventAtom } from "../state/commands";

export const useTrackEvent = () => {
  const dispatch = useAtomSet(trackEventAtom);

  return (event: TrackEventKey, properties?: Properties) =>
    dispatch({ event, properties });
};
