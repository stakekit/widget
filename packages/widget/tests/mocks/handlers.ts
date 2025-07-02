import { getStakeKitMock } from "@stakekit/api-hooks/msw";
import { delay, HttpResponse, http, passthrough } from "msw";

export const handlers = [
  http.get("*/v1/actions/:actionId/gas-estimate", async () => {
    await delay();

    return new HttpResponse(null, { status: 400 });
  }),
  http.get("https://i18n.stakek.it/locales/en/errors.json", async () => {
    await delay();

    return HttpResponse.json({});
  }),
  http.get("*relay.walletconnect*", async () => {
    await delay();

    return new HttpResponse(null, { status: 500 });
  }),
  http.all("*", passthrough),
  ...getStakeKitMock(),
];
