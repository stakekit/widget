import { Data, Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import {
  getEarningCampaign,
  withCampaignRate,
  type YieldCampaign,
} from "../../domain/earn/campaign";
import type { EarnYield } from "../../domain/earn/yield-schema";
import type { YieldId } from "../../domain/identity/identifiers";
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
import { presentationClockAtom } from "../../shared/effect/presentation-clock";
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

/**
 * Each yield's campaigns as far as they have loaded: none while they load or
 * after they failed, so nothing that reads them waits on them.
 */
export const loadedCampaignsByYieldAtom = Atom.make(
  (get): ReadonlyMap<YieldId, ReadonlyArray<YieldCampaign>> =>
    get(projectCampaignsResourceAtom.local).pipe(
      AsyncResult.value,
      Option.getOrElse((): ReadonlyArray<YieldCampaign> => []),
      (campaigns) => Map.groupBy(campaigns, (campaign) => campaign.yieldId)
    )
).pipe(Atom.withLabel("loadedCampaignsByYieldAtom"));

type EarningCampaigns = ReadonlyMap<YieldId, YieldCampaign>;

const sameEarningCampaigns = (a: EarningCampaigns, b: EarningCampaigns) =>
  a.size === b.size &&
  [...a].every(([yieldId, campaign]) => b.get(yieldId) === campaign);

/**
 * Each yield's earning campaign at the presentation time, in the order the
 * API lists the campaigns. It changes only when a campaign starts, ends or
 * reloads, not on every clock tick.
 */
export const earningCampaignsAtom = Atom.make((get): EarningCampaigns => {
  const clock = get(presentationClockAtom);
  if (!clock) return new Map();
  return new Map(
    [...get(loadedCampaignsByYieldAtom)].flatMap(([yieldId, campaigns]) => {
      const earning = getEarningCampaign(campaigns, clock.now);
      return earning ? [[yieldId, earning] as const] : [];
    })
  );
}).pipe(
  Atom.withEquality(sameEarningCampaigns),
  Atom.withLabel("earningCampaignsAtom")
);

/**
 * Adds to a yield its earning campaign's rate when its own rate doesn't list
 * one yet (see `withCampaignRate`), so a campaign that starts or ends while
 * the widget is open moves the rate with it.
 */
export const liveCampaignRateAtom = Atom.make((get) => {
  const earning = get(earningCampaignsAtom);
  return <Y extends Pick<EarnYield, "id" | "rewardRate">>(yieldDto: Y): Y => {
    const campaign = earning.get(yieldDto.id);
    return campaign ? withCampaignRate(yieldDto, campaign) : yieldDto;
  };
}).pipe(Atom.withLabel("liveCampaignRateAtom"));
