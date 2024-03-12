import { HttpResponse, delay, http, passthrough } from "msw";
import { setupWorker } from "msw/browser";

const validReferrals = ["bgdCZB", "bgdCZC"];
const validAddressAndNetwork = {
  address: "akash12z0hpqxj3txaf85zlla7zqffp7n9sl8wc3hlzh",
  network: "akash",
};
const referralCodeRes = { id: "aaa-bbb", code: validReferrals[0] };

export const worker = setupWorker(
  // http.post("*/v1/actions/enter", async () => {
  //   await delay();
  //   return HttpResponse.json(
  //     {
  //       message: "YieldUnderMaintenanceError",
  //       details: { yieldId: "optimism-op-aave-v3-lending" },
  //     },
  //     { status: 400 }
  //   );
  // }),
  // Validate referral code
  http.get<
    { referralCode: string },
    never,
    { message: string } | typeof referralCodeRes
  >("*/v1/referrals/:referralCode", async (info) => {
    await delay(3000);

    if (info.params.referralCode !== validReferrals[0]) {
      return HttpResponse.json(
        { message: "MissingArgumentsError" },
        { status: 400, statusText: "Not valid" }
      );
    }

    return HttpResponse.json(referralCodeRes);
  }),

  // Get referral code for address
  http.get(
    "*/v1/networks/:networkSlug/addresses/:address/referrals",
    async (info) => {
      await delay();

      const networkSlug = info.params["networkSlug"];
      const address = info.params["address"];

      if (
        networkSlug === validAddressAndNetwork.network &&
        address === validAddressAndNetwork.address
      ) {
        return HttpResponse.json(referralCodeRes);
      }

      return new HttpResponse(null, { status: 404, statusText: "Not found" });
    }
  ),

  // ...If we couldn't get one, generate referral code for address
  http.post(
    "*/v1/networks/:networkSlug/addresses/:address/referrals",
    async () => {
      await delay();

      return HttpResponse.json({ ...referralCodeRes, code: validReferrals[1] });
    }
  ),

  http.all("*", () => {
    return passthrough();
  })
);
