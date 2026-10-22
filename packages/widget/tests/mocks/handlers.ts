import { HttpResponse, http, passthrough } from "msw";
import { getExternalApiMock } from "./external-api-handlers";
import { getLegacyApiMock } from "./legacy-api-handlers";
import { getYieldApiMock } from "./yield-api-handlers";

// Fails every unmocked request except the app's own non-API assets. The app
// origin comes from `appOrigin`: the test page, or a smoke-test host server.
export const getHandlers = (appOrigin: () => string) => [
  ...getExternalApiMock(appOrigin),
  ...getLegacyApiMock(),
  ...getYieldApiMock(),
  http.all("*", async ({ request }) => {
    const url = new URL(request.url);
    const isAppApiPath =
      url.pathname === "/health" ||
      url.pathname.startsWith("/v1/") ||
      url.pathname.startsWith("/v2/");
    if (url.origin === appOrigin() && !isAppApiPath) {
      return passthrough();
    }

    return HttpResponse.json(
      {
        message: `Unhandled test request: ${request.method} ${request.url}`,
      },
      { status: 500 }
    );
  }),
];

export const handlers = getHandlers(() => window.location.origin);
