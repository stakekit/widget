import { HttpResponse, http } from "msw";

import { yieldApiRoute } from "./api-routes";
import { mockDelay } from "./delay";

/**
 * `GET /v1/campaigns` serving `campaigns` by the requested status, one page
 * at a time.
 */
export const projectCampaignsHandler = (
  campaigns: ReadonlyArray<Readonly<Record<string, unknown>>>
) =>
  http.get(yieldApiRoute("/v1/campaigns"), async ({ request }) => {
    await mockDelay();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "active";
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const matching = campaigns.filter(
      (campaign) => (campaign["status"] ?? "active") === status
    );
    return HttpResponse.json({
      items: matching.slice(offset, offset + limit),
      limit,
      offset,
      total: matching.length,
    });
  });
