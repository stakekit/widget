import { useAtomValue } from "@effect/atom-react";
import { useLayoutEffect } from "react";

import { applicationScrollResetAtom } from "../../runtime/application-router";

/**
 * Runs a requested window scroll reset once the page for `locationKey` is in
 * the DOM, before the browser paints it. Render it inside the page's
 * `PageTransition`: a leaving page keeps the key it was given, so the reset
 * waits for the next page to enter rather than moving the one leaving.
 */
export const PageScrollReset = ({
  locationKey,
}: {
  readonly locationKey: string;
}) => {
  const scrollReset = useAtomValue(applicationScrollResetAtom);
  useLayoutEffect(() => {
    scrollReset.pageCommitted(locationKey);
  }, [scrollReset, locationKey]);
  return null;
};
