import { describe, it, beforeAll, afterEach, afterAll } from "vitest";
import { server } from "./mocks/server";
import { rendersInitialPage } from "./use-cases/renders-initial-page";
import { selectOpportunity } from "./use-cases/select-opportunity";
import { APIManager } from "@stakekit/api-hooks";
import { stakingFlow } from "./use-cases/staking-flow";
import { referralFlow } from "./use-cases/referral-flow";

describe("<SKApp />", () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    APIManager.getQueryClient()?.clear();
    server.resetHandlers();
    localStorage.clear();
  });
  afterAll(() => server.close());

  it("Should render initial page correctly", rendersInitialPage);
  describe("Referral flow works correctly", referralFlow);
  it("Selecting yield opportunity works as expected", selectOpportunity);
  it("Staking flow works correctly", stakingFlow);
});
