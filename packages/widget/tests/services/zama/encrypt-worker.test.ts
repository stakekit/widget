import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  HttpClient,
  HttpClientError,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/http";
import { isEncryptWorkerServed } from "../../../src/services/zama/encrypt-worker";

const workerUrl = "https://host.example/assets/encrypt.worker-abc.js";

const served = (
  origin: string,
  respond: (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    HttpClientError.HttpClientError
  >
) => isEncryptWorkerServed(HttpClient.make(respond), workerUrl, origin);

const response =
  (status: number, contentType: string) =>
  (request: HttpClientRequest.HttpClientRequest) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(null, { headers: { "content-type": contentType }, status })
      )
    );

describe("isEncryptWorkerServed", () => {
  it.effect(
    "uses the host's copy when it serves the script as JavaScript",
    () =>
      Effect.gen(function* () {
        expect(
          yield* served(
            "https://host.example",
            response(200, "text/javascript; charset=utf-8")
          )
        ).toBe(true);
      })
  );

  it.effect.each([
    ["the host did not copy the script", 404, "text/html; charset=utf-8"],
    ["the host answers with its HTML fallback", 200, "text/html"],
  ] as const)("falls back when %s", ([, status, contentType]) =>
    Effect.gen(function* () {
      expect(
        yield* served("https://host.example", response(status, contentType))
      ).toBe(false);
    })
  );

  it.effect("falls back when the request fails", () =>
    Effect.gen(function* () {
      expect(
        yield* served("https://host.example", (request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({ request }),
            })
          )
        )
      ).toBe(false);
    })
  );

  it.effect(
    "falls back without a request when the script is on another origin",
    () =>
      Effect.gen(function* () {
        // Browsers only start workers from same-origin scripts, e.g. when the
        // widget bundle itself is served from a CDN.
        expect(
          yield* served("https://app.example", () =>
            Effect.die("must not request a cross-origin script")
          )
        ).toBe(false);
      })
  );
});
