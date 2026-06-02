import { delay, HttpResponse, http } from "msw";
import { yieldApiRoute } from "../../mocks/api-routes";
import type { TestWorker } from "../../utils/test-extend";
import { setup as stakingSetup } from "../staking-flow/setup";

// reuses the staking-flow setup; overrides the yield to require kyc + adds the status endpoint
export const setup = async (worker: TestWorker) => {
  const base = await stakingSetup(worker);
  const kycUrl = "https://issuer.example/kyc";

  // Strip the merged __fallback__ — it isn't part of the yield-api response.
  const { __fallback__, ...apiYield } = base.yieldOp;
  const yieldWithKyc = {
    ...apiYield,
    mechanics: {
      ...apiYield.mechanics,
      requirements: { kycRequired: true, kycUrl },
    },
  };

  // Runtime handlers added later take precedence in msw.
  worker.use(
    http.get(
      yieldApiRoute("/v1/yields/avalanche-avax-liquid-staking"),
      async () => {
        await delay();
        return HttpResponse.json(yieldWithKyc);
      }
    ),
    http.get(yieldApiRoute("/v1/yields/:yieldId/kyc/status"), async () => {
      await delay();
      return HttpResponse.json({ kycStatus: "not_started" });
    })
  );

  return { ...base, kycUrl };
};
