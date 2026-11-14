import type { DateTime } from "effect";

import type { DisplayedCampaign } from "../../../domain/earn/campaign";

/** The campaign a yield shows now, with the time it was projected at. */
export type YieldCampaignView = DisplayedCampaign & {
  readonly now: DateTime.Utc;
  readonly timeZone: DateTime.TimeZone;
};
