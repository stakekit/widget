import { Schema, SchemaTransformation } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
import * as YieldApi from "../../generated/api/yield-schema";
import { TolerantTopLevelRecord } from "../decoding/response-schema";
import { UtcDateTimeFromString } from "../finance/scalars";
import { Token } from "../token/token";

export const HealthStatus = Schema.Struct({
  ...YieldApi.HealthStatusDto.fields,
  timestamp: UtcDateTimeFromString,
});
export type HealthStatus = typeof HealthStatus.Type;

const PriceToken = LegacyApi.TokenDto.pipe(Schema.decodeTo(Token));

const PriceRequestModel = Schema.Struct({
  currency: Schema.String,
  tokenList: Schema.Array(PriceToken),
});
export const PriceRequest = LegacyApi.PriceRequestDto.pipe(
  Schema.decodeTo(PriceRequestModel)
);
export type PriceRequest = typeof PriceRequest.Type;

type Price = {
  readonly price: number | undefined;
  readonly price24H: number | undefined;
};

export class Prices {
  constructor(public readonly value: Map<string, Price>) {}

  getByToken(token: {
    readonly symbol: string;
    readonly network: string;
    readonly address?: string;
  }) {
    const priceKey = `${token.network}-${token.address?.toLowerCase() ?? ""}`;
    const price = this.value.get(priceKey);

    return (
      price ??
      // Some legacy price responses serialize native tokens as `undefined`
      // instead of the normal empty-address suffix.
      (token.address === undefined
        ? this.value.get(`${token.network}-undefined`)
        : undefined) ??
      null
    );
  }
}

const PriceEntry = Schema.Struct({
  price: Schema.optionalKey(Schema.Number.check(Schema.isFinite())),
  price_24_h: Schema.optionalKey(Schema.Number.check(Schema.isFinite())),
});

const PriceEntries = TolerantTopLevelRecord(Schema.NonEmptyString, PriceEntry, {
  operation: "token-prices",
});

export const PriceResponse = PriceEntries.pipe(
  Schema.decodeTo(
    Schema.instanceOf(Prices),
    SchemaTransformation.transform({
      decode: (entries): Prices =>
        new Prices(
          new Map(
            Object.entries(entries).map(([key, value]) => [
              key,
              {
                price: value.price,
                price24H: value.price_24_h,
              },
            ])
          )
        ),
      encode: (
        prices: Prices
      ): Readonly<
        Record<
          string,
          { readonly price?: number; readonly price_24_h?: number }
        >
      > =>
        Object.fromEntries(
          Array.from(prices.value, ([key, value]) => [
            key,
            {
              price: value.price,
              price_24_h: value.price24H,
            },
          ])
        ),
    })
  )
);
