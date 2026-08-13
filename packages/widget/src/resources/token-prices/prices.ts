import { Data } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnYieldWithProvider } from "../../domain/earn/models";
import type { PriceRequest } from "../../domain/health/models";
import type { Token } from "../../domain/token/token";
import { makePresentableResourceFamily } from "../resource-failure-presentation";
import { TokenPricesKey, tokenPricesResourceAtom } from "./token-prices";

const DEFAULT_CURRENCY = "USD";

export class PricesKey extends Data.Class<{
  readonly request: PriceRequest | null;
}> {}

export const getTokensPricesRequest = ({
  token,
  yieldDto,
}: {
  readonly token: Token | null;
  readonly yieldDto: EarnYieldWithProvider | null;
}): PriceRequest | null =>
  token && yieldDto
    ? {
        currency: DEFAULT_CURRENCY,
        tokenList: [token, token, yieldDto.mechanics.gasFeeToken],
      }
    : null;

const pricesCanonicalAtom = Atom.family((key: PricesKey) =>
  Atom.make((get) =>
    key.request
      ? get(tokenPricesResourceAtom.local(new TokenPricesKey(key.request)))
      : AsyncResult.success(null)
  ).pipe(Atom.withLabel("pricesAtom"))
);

export const pricesAtom = makePresentableResourceFamily(pricesCanonicalAtom);
