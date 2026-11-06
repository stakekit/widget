import { DateTime } from "effect";

import { formatDateTime } from "../../../shared/lib/date";
import type { ActivityActionItem } from "./activity-action";

/** The calendar day a time falls on in the presentation zone: `YYYY-MM-DD`. */
export const getActivityDayKey = (
  value: DateTime.Utc,
  timeZone: DateTime.TimeZone
): string => DateTime.formatIsoDate(DateTime.setZone(value, timeZone));

export type ActivityDayLabel =
  | { readonly _tag: "today" }
  | { readonly _tag: "yesterday" }
  | { readonly _tag: "date"; readonly label: string };

type ActivityDayGroup = {
  /** The day, `YYYY-MM-DD`. */
  readonly key: string;
  readonly day: ActivityDayLabel;
  readonly items: ReadonlyArray<ActivityActionItem>;
};

/**
 * The feed in one group per calendar day an action was created on, in the
 * presentation zone, in feed order: today's and yesterday's by name, older
 * days by their date.
 */
export const groupActivityActionsByDay = ({
  actions,
  locale,
  presentationTime: { now, timeZone },
}: {
  readonly actions: ReadonlyArray<ActivityActionItem>;
  readonly locale: string;
  readonly presentationTime: {
    readonly now: DateTime.Utc;
    readonly timeZone: DateTime.TimeZone;
  };
}): ReadonlyArray<ActivityDayGroup> => {
  const zonedNow = DateTime.setZone(now, timeZone);
  const today = DateTime.formatIsoDate(zonedNow);
  const yesterday = DateTime.formatIsoDate(
    DateTime.subtract(zonedNow, { days: 1 })
  );
  const groups = new Map<
    string,
    {
      readonly day: ActivityDayLabel;
      readonly items: Array<ActivityActionItem>;
    }
  >();

  for (const item of actions) {
    const { createdAt } = item.actionData;
    const key = getActivityDayKey(createdAt, timeZone);
    const group = groups.get(key);
    if (group) {
      group.items.push(item);
      continue;
    }
    groups.set(key, {
      day: projectDayLabel({
        createdAt,
        key,
        locale,
        timeZone,
        today,
        yesterday,
      }),
      items: [item],
    });
  }

  return Array.from(groups, ([key, { day, items }]) => ({ key, day, items }));
};

const projectDayLabel = ({
  createdAt,
  key,
  locale,
  timeZone,
  today,
  yesterday,
}: {
  readonly createdAt: DateTime.Utc;
  readonly key: string;
  readonly locale: string;
  readonly timeZone: DateTime.TimeZone;
  readonly today: string;
  readonly yesterday: string;
}): ActivityDayLabel => {
  if (key === today) return { _tag: "today" };
  if (key === yesterday) return { _tag: "yesterday" };
  return {
    _tag: "date",
    label: formatDateTime(createdAt, {
      locale,
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
};
