import { Schema, SchemaGetter, Struct } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { TolerantArray } from "../decoding/response-schema";
import { ValidatorAddress, YieldId } from "../identity/identifiers";
import { Token } from "../token/token";
import { EarnPosition } from "./balance";
import { EarnValidator } from "./validator";
import { EarnYield } from "./yield-schema";

export const EarnYieldBalancesResponse = EarnPosition;
export type EarnYieldBalancesResponse = EarnPosition;

const YieldIdentifier = Schema.Struct({ id: YieldId }).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => value.id),
    encode: SchemaGetter.forbidden(() => "Yield identifier is decode-only"),
  })
);

const ValidatorIdentifier = Schema.Struct({ address: ValidatorAddress }).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => value.address),
    encode: SchemaGetter.forbidden(() => "Validator identifier is decode-only"),
  })
);

const makeEarnYieldPage = (operation: string) =>
  Schema.Struct({
    // Pagination reads these to request the remaining pages.
    ...Struct.pick(YieldApi.YieldsControllerGetYields200.fields, [
      "total",
      "offset",
      "limit",
    ]),
    items: Schema.optionalKey(
      TolerantArray(EarnYield, {
        operation,
        identifier: YieldIdentifier,
      })
    ),
  });

export const EarnYieldPage = makeEarnYieldPage("earn-yield-catalog");

const EarnTokenWithAvailableYields = Schema.Struct({
  token: Token,
  availableYields: Schema.Array(YieldId),
});

const EarnTokenWithAvailableYieldItems = TolerantArray(
  EarnTokenWithAvailableYields,
  { operation: "default-token-options" }
);

export const EarnLegacyTokenOptionsResponse = EarnTokenWithAvailableYieldItems;

const EarnValidatorItems = TolerantArray(EarnValidator, {
  operation: "validators",
  identifier: ValidatorIdentifier,
});

export const EarnValidatorPage = Schema.Struct({
  ...Struct.pick(YieldApi.YieldsControllerGetYieldValidators200.fields, [
    "total",
    "offset",
    "limit",
  ]),
  items: Schema.optionalKey(EarnValidatorItems),
});

export const EarnPositionsResponse = Schema.Struct({
  items: TolerantArray(EarnPosition, {
    operation: "positions-data",
  }),
});
