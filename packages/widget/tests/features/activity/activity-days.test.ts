import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { ActivityActionItem } from "../../../src/features/activity/model/activity-action";
import { groupActivityActionsByDay } from "../../../src/features/activity/model/activity-days";
import { yieldApiActionFixture } from "../../fixtures";

const itemAt = (id: string, createdAt: string): ActivityActionItem => ({
  _tag: "yield",
  actionData: yieldApiActionFixture({
    createdAt: DateTime.makeUnsafe(createdAt),
    id,
  }),
  validatorsData: [],
  walletScope: {} as never,
  yieldData: null,
});

describe("Activity day groups", () => {
  it("groups the feed by calendar day in the presentation zone, in feed order", () => {
    const groups = groupActivityActionsByDay({
      actions: [
        itemAt("today-late", "2026-07-28T09:00:00.000Z"),
        // 00:30 in Paris: still today there, yesterday in UTC.
        itemAt("today-early", "2026-07-27T22:30:00.000Z"),
        itemAt("yesterday", "2026-07-27T08:00:00.000Z"),
        itemAt("older", "2024-05-10T12:00:00.000Z"),
      ],
      locale: "en-US",
      presentationTime: {
        now: DateTime.makeUnsafe("2026-07-28T10:00:00.000Z"),
        timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
      },
    });

    expect(
      groups.map(({ day, items, key }) => ({
        day,
        ids: items.map((item) => item.actionData.id),
        key,
      }))
    ).toEqual([
      {
        day: { _tag: "today" },
        ids: ["today-late", "today-early"],
        key: "2026-07-28",
      },
      { day: { _tag: "yesterday" }, ids: ["yesterday"], key: "2026-07-27" },
      {
        day: { _tag: "date", label: "May 10, 2024" },
        ids: ["older"],
        key: "2024-05-10",
      },
    ]);
  });
});
