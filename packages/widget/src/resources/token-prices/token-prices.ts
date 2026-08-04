import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  InputValidationError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import {
  type PriceRequest,
  Prices,
} from "../../domain/schema/health-price-models";
import { tokenString } from "../../domain/types/tokens";
import { LegacyResourceSource } from "../../services/api/legacy-resource-source";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

export class TokenPricesKey extends Data.TaggedClass("TokenPricesKey")<{
  readonly request: PriceRequest;
}> {
  constructor(request: PriceRequest) {
    const byIdentity = new Map(
      request.tokenList.map((token) => [tokenString(token), token])
    );
    super({
      request: {
        currency: request.currency,
        tokenList: [...byIdentity.entries()]
          .sort(([first], [second]) => first.localeCompare(second))
          .map(([, token]) => token),
      },
    });
  }
}

class TokenPricesError extends Data.TaggedError("TokenPricesError")<{
  readonly cause: ApiRequestError | InputValidationError | ResponseDecodeError;
}> {}

const pricesPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(2),
});

const tokenPricesCanonicalAtom = Atom.family((key: TokenPricesKey) =>
  appRuntime
    .atom(() =>
      key.request.tokenList.length === 0
        ? Effect.succeed(new Prices(new Map()))
        : LegacyResourceSource.use((source) =>
            source.getPrices(key.request)
          ).pipe(Effect.mapError((cause) => new TokenPricesError({ cause })))
    )
    .pipe(pricesPolicy, Atom.withLabel("tokenPricesResourceAtom"))
);

export const tokenPricesResourceAtom = makePresentableResourceFamily(
  tokenPricesCanonicalAtom
);
