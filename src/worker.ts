import { HttpResponse, delay, http, passthrough } from "msw";
import { setupWorker } from "msw/browser";

const validReferral = "bgdCZB";
const validAddressAndNetwork = {
  address: "akash12z0hpqxj3txaf85zlla7zqffp7n9sl8wc3hlzh",
  network: "akash",
};
const referralCodeRes = { id: "aaa-bbb", code: "czBG45" };

export const worker = setupWorker(
  // Validate referral code
  http.get<
    { referralCode: string },
    never,
    { message: string } | typeof referralCodeRes
  >("*/v1/referral-code/:referralCode", async (info) => {
    await delay(3000);

    if (info.params.referralCode !== validReferral) {
      return HttpResponse.json(
        { message: "MissingArgumentsError" },
        { status: 400, statusText: "Not valid" }
      );
    }

    return HttpResponse.json(referralCodeRes);
  }),

  // Get referral code for address
  http.get(
    "*/v1/network/:networkSlug/address/:address/referral-code",
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
    "*/v1/network/:networkSlug/address/:address/referral-code",
    async () => {
      await delay();

      return HttpResponse.json(referralCodeRes);
    }
  ),

  http.all("*", () => {
    return passthrough();
  })
);
