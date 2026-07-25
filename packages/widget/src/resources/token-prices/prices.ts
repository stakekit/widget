import { Data } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnYieldWithProvider } from "../../domain/schema/earn-models";
import type { PriceRequest } from "../../domain/schema/health-price-models";
import type { AppToken } from "../../domain/schema/legacy-models";
import { TokenPricesKey, tokenPricesResourceAtom } from "./token-prices";

const DEFAULT_CURRENCY = "USD";

export class PricesKey extends Data.Class<{
  readonly request: PriceRequest | null;
}> {}

export const getTokensPricesRequest = ({
  token,
  yieldDto,
}: {
  readonly token: AppToken | null;
  readonly yieldDto: EarnYieldWithProvider | null;
}): PriceRequest | null =>
  token && yieldDto
    ? {
        currency: DEFAULT_CURRENCY,
        tokenList: [token, token, yieldDto.mechanics.gasFeeToken],
      }
    : null;

export const pricesAtom = Atom.family((key: PricesKey) =>
  Atom.make((get) =>
    key.request
      ? get(tokenPricesResourceAtom(new TokenPricesKey(key.request)))
      : AsyncResult.success(null)
  ).pipe(Atom.withLabel("pricesAtom"))
);
