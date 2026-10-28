import { useAtomSet } from "@effect/atom-react";
import type {
  TrackEventArgs,
  TrackEventKey,
} from "../../../services/tracking/types";
import { trackEventAtom } from "../state/commands";

export const useTrackEvent = () => {
  const dispatch = useAtomSet(trackEventAtom);

  return <Event extends TrackEventKey>(
    event: Event,
    ...[properties]: TrackEventArgs<Event>
  ) => dispatch({ event, properties });
};
