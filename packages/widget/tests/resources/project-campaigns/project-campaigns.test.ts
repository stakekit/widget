import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

import { YieldCampaignPage } from "../../../src/domain/earn/campaign";
import { projectCampaignsResourceAtom } from "../../../src/resources/project-campaigns/project-campaigns";
import { appRuntime } from "../../../src/runtime/app-runtime";
import type {
  ProjectCampaignsRequest,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { yieldApiCampaignDtoFixture } from "../../fixtures";
import { yieldResourceSourceLayer } from "../../utils/services/resource-sources";

const page = (
  request: ProjectCampaignsRequest,
  items: ReadonlyArray<Readonly<Record<string, unknown>>>,
  total: number
) =>
  Schema.decodeSync(YieldCampaignPage)({
    items,
    limit: request.limit,
    offset: request.offset,
    total,
  });

const makeRegistry = (source: Partial<YieldResourceSource["Service"]>) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(appRuntime.layer, yieldResourceSourceLayer(source)),
    ],
  });

describe("Project campaigns resource", () => {
  it("reads every running and paused campaign of the project, across pages, in one place", () => {
    const listProjectCampaigns = vi.fn((request: ProjectCampaignsRequest) =>
      Effect.succeed(
        request.status === "active"
          ? page(
              request,
              [yieldApiCampaignDtoFixture({ id: `live-${request.offset}` })],
              150
            )
          : page(
              request,
              [yieldApiCampaignDtoFixture({ id: "paused", status: "paused" })],
              1
            )
      )
    );
    const registry = makeRegistry({ listProjectCampaigns });

    const campaigns = AsyncResult.getOrThrow(
      registry.get(projectCampaignsResourceAtom)
    );

    expect(campaigns.map(({ id }) => id).sort()).toEqual([
      "live-0",
      "live-100",
      "paused",
    ]);
    expect(
      listProjectCampaigns.mock.calls.map(([request]) => [
        request.status,
        request.offset,
      ])
    ).toEqual(
      expect.arrayContaining([
        ["active", 0],
        ["active", 100],
        ["paused", 0],
      ])
    );
    expect(listProjectCampaigns).toHaveBeenCalledTimes(3);
  });
});
