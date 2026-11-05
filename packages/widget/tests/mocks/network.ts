import { FetchInterceptor } from "@mswjs/interceptors/fetch";
import { XMLHttpRequestInterceptor } from "@mswjs/interceptors/XMLHttpRequest";
import { defineNetwork, InterceptorSource } from "msw/experimental";
import { handlers } from "./handlers";

/**
 * The mocked API for Chromium tests: MSW's `fetch` and `XMLHttpRequest`
 * interceptors in the test page, answering from `handlers`. No service worker
 * is registered, so the mocks live and die with the test file's page.
 *
 * Enable it before the page sends its first request: Effect's
 * `FetchHttpClient.Fetch` keeps the first `fetch` it reads, so the
 * interceptors must have patched it by then.
 */
export const network = defineNetwork({
  sources: [
    new InterceptorSource({
      interceptors: [new FetchInterceptor(), new XMLHttpRequestInterceptor()],
    }),
  ],
  handlers: [...handlers],
  context: { quiet: true },
});
