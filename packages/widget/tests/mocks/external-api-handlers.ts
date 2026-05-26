import { delay, HttpResponse, http } from "msw";

export const getExternalApiMock = () => [
  http.get("https://i18n.stakek.it/locales/:language/errors.json", async () => {
    await delay();

    return HttpResponse.json({});
  }),

  http.get("https://api.web3modal.org/appkit/v1/config", async () => {
    await delay();

    return HttpResponse.json({
      features: [],
    });
  }),

  http.get("https://api.web3modal.org/projects/v1/origins", async () => {
    await delay();

    return HttpResponse.json({
      allowedOrigins: [window.location.origin],
    });
  }),

  http.get("https://dapp.stakek.it/tonconnect-manifest.json", async () => {
    await delay();

    return HttpResponse.json({
      url: window.location.origin,
      name: "StakeKit Widget Test",
      iconUrl: "https://assets.stakek.it/stakekit/sk-icon_320x320.png",
    });
  }),
];
