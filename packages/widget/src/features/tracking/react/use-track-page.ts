import { useAtomSet } from "@effect/atom-react";
import { useEffect, useEffectEvent } from "react";
import type {
  TrackPageArgs,
  TrackPageKey,
} from "../../../services/tracking/types";
import { trackPageViewAtom } from "../state/commands";

export const useTrackPage = <Page extends TrackPageKey>(
  pageName: Page,
  ...[properties]: TrackPageArgs<Page>
) => {
  const trackPageView = useAtomSet(trackPageViewAtom);

  const reportPageView = useEffectEvent((page: Page) =>
    trackPageView({ page, properties })
  );

  useEffect(() => {
    reportPageView(pageName);
  }, [pageName]);
};
