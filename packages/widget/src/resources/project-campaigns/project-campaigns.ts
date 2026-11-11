import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

import type { YieldCampaign } from "../../domain/earn/campaign";
import { appRuntime } from "../../runtime/app-runtime";
import type {
  ApiRequestError,
  ProjectCampaignsRequest,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import {
  API_MAX_PAGE_SIZE,
  loadAllPages,
} from "../../shared/effect/pagination";
import { makePresentableResource } from "../resource-failure-presentation";

class ProjectCampaignsError extends Data.TaggedError("ProjectCampaignsError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

// Matches the yield Resources, whose reward rates include campaign incentives.
const projectCampaignsPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(5),
});

// Ended campaigns are never shown, so only running (upcoming included) and
// paused ones are read.
const shownStatuses = ["active", "paused"] as const satisfies ReadonlyArray<
  ProjectCampaignsRequest["status"]
>;

const projectCampaignsCanonicalAtom = appRuntime
  .atom(() =>
    YieldResourceSource.use((source) =>
      Effect.forEach(
        shownStatuses,
        (status) =>
          loadAllPages({
            concurrency: 2,
            pageSize: API_MAX_PAGE_SIZE,
            fetchPage: (offset) =>
              source.listProjectCampaigns({
                limit: API_MAX_PAGE_SIZE,
                offset,
                status,
              }),
          }),
        { concurrency: "unbounded" }
      )
    ).pipe(
      Effect.mapBoth({
        onSuccess: (pages): ReadonlyArray<YieldCampaign> => pages.flat(),
        onFailure: (cause) => new ProjectCampaignsError({ cause }),
      })
    )
  )
  .pipe(
    Atom.withReactivity(resourceInvalidationKeys.yieldCatalog()),
    projectCampaignsPolicy,
    Atom.withLabel("projectCampaignsResourceAtom")
  );

/**
 * Every running, upcoming and paused campaign of the project, in one read
 * that serves every yield.
 */
export const projectCampaignsResourceAtom = makePresentableResource(
  projectCampaignsCanonicalAtom
);
