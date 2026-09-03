import { Duration } from "effect";
import { useEffect, useState } from "react";

/**
 * Named React/DOM boundary: delaying paint is the one thing Effect cannot own
 * here, because the decision is about frames the user sees rather than about
 * work being done. The busy flag itself stays authoritative elsewhere; this hook
 * only decides when its chrome may appear.
 *
 * One wait at a time holds the claim on the chrome. Rendering compares that
 * claim against the current wait, so a claim left by an earlier wait can never
 * paint; a replaced or settled claim is dropped during render so a later wait
 * has to earn the chrome again.
 */

const defaultShowAfter = Duration.millis(500);

const defaultMinVisible = Duration.millis(200);

type VisibleWait = { readonly key: unknown };

/**
 * Whether busy chrome (spinner, dimming) may be shown. A wait shorter than
 * `showAfter` never renders chrome, and chrome that does appear stays for at
 * least `minVisible` so a request settling just past the delay cannot blink.
 * A new `waitKey` is a new wait: chrome hides at once and waits again.
 */
export const useDelayedBusy = (
  busy: boolean,
  waitKey: unknown,
  options: {
    readonly minVisible?: Duration.Duration;
    readonly showAfter?: Duration.Duration;
  } = {}
) => {
  const showAfterMillis = Duration.toMillis(
    options.showAfter ?? defaultShowAfter
  );
  const minVisibleMillis = Duration.toMillis(
    options.minVisible ?? defaultMinVisible
  );
  const [visibleWait, setVisibleWait] = useState<VisibleWait | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  if (visibleWait !== null) {
    const isReplaced = visibleWait.key !== waitKey;
    const isSettled = !busy && !isHolding;

    if (isReplaced || isSettled) {
      setVisibleWait(null);
      if (isReplaced) setIsHolding(false);
    }
  }

  const isVisible = visibleWait !== null && visibleWait.key === waitKey;

  useEffect(() => {
    if (!busy || isVisible) return;

    const timer = setTimeout(() => {
      setVisibleWait({ key: waitKey });
      setIsHolding(true);
    }, showAfterMillis);

    return () => clearTimeout(timer);
  }, [busy, isVisible, showAfterMillis, waitKey]);

  useEffect(() => {
    if (!visibleWait) return;

    const timer = setTimeout(() => setIsHolding(false), minVisibleMillis);

    return () => clearTimeout(timer);
  }, [minVisibleMillis, visibleWait]);

  return isVisible;
};
