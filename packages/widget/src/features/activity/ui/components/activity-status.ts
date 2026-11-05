import type { FixedIconName } from "../../../../ui/index";
import type { ActivityStatusLabel } from "../../model/activity-action-list-item";

/** A status called out on a list row or the receipt's head. */
type ActivityStatusCallout = {
  readonly tone: "warning" | "danger" | "info";
  readonly icon: FixedIconName;
};

type ActivityStatusLook = {
  /**
   * How a row and the receipt's head call the status out. A completed action
   * is the expected outcome, so it is not called out.
   */
  readonly callout: ActivityStatusCallout | null;
  /** The status's tone where the receipt's facts state it. */
  readonly factTone: "default" | "warning" | "danger";
};

/** How each status reads wherever Activity shows it. */
export const activityStatusLook: Record<
  ActivityStatusLabel,
  ActivityStatusLook
> = {
  awaiting_settlement: {
    callout: { tone: "info", icon: "HistoryIcon" },
    factTone: "default",
  },
  canceled: {
    callout: { tone: "warning", icon: "WarningIcon" },
    factTone: "warning",
  },
  completed: { callout: null, factTone: "default" },
  created: {
    callout: { tone: "info", icon: "HistoryIcon" },
    factTone: "default",
  },
  expired: {
    callout: { tone: "warning", icon: "WarningIcon" },
    factTone: "warning",
  },
  failed: {
    callout: { tone: "danger", icon: "XIcon" },
    factTone: "danger",
  },
  processing: {
    callout: { tone: "info", icon: "HistoryIcon" },
    factTone: "default",
  },
  stale: {
    callout: { tone: "warning", icon: "WarningIcon" },
    factTone: "warning",
  },
};

/** The status a row or the receipt's head calls out, with its text. */
export const toActivityStatusCallout = (
  status: ActivityStatusLabel | null,
  text: string | null
): (ActivityStatusCallout & { readonly text: string }) | null => {
  const callout = status ? activityStatusLook[status].callout : null;
  return callout && text ? { ...callout, text } : null;
};
