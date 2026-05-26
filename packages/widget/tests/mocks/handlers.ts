import { delay, HttpResponse, http, passthrough } from "msw";
import { getExternalApiMock } from "./external-api-handlers";
import { getLegacyApiMock } from "./legacy-api-handlers";
import { getYieldApiMock } from "./yield-api-handlers";

export const handlers = [
  ...getExternalApiMock(),
  ...getLegacyApiMock(),
  ...getYieldApiMock(),
  http.all("*", async ({ request }) => {
    const url = new URL(request.url);
    const isAppApiPath =
      url.pathname === "/health" ||
      url.pathname.startsWith("/v1/") ||
      url.pathname.startsWith("/v2/");

    if (url.origin === window.location.origin && !isAppApiPath) {
      return passthrough();
    }

    await delay();

    return HttpResponse.json(
      {
        message: `Unhandled test request: ${request.method} ${request.url}`,
      },
      { status: 500 }
    );
  }),
];
