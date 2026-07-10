import { Option, Schema, SchemaGetter } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { PendingAction } from "./action-models";
import {
  ProviderId,
  TokenAddress,
  ValidatorAddress,
  YieldId,
} from "./identifiers";
import { TolerantTopLevelArray } from "./response";
import { BigIntFromString, PrecisionDecimalFromString } from "./scalars";

export const EarnToken = Schema.Struct({
  ...YieldApi.TokenDto.fields,
  decimals: Schema.Number.check(Schema.isInt()),
  address: Schema.optionalKey(TokenAddress),
});
export type EarnToken = typeof EarnToken.Type;

export const EarnProvider = Schema.Struct({
  ...YieldApi.ProviderDto.fields,
  id: ProviderId,
});
export type EarnProvider = typeof EarnProvider.Type;

export const EarnValidatorKey = Schema.NonEmptyString.pipe(
  Schema.brand("EarnValidatorKey")
);
export type EarnValidatorKey = typeof EarnValidatorKey.Type;

const makeEarnValidatorKey = Schema.decodeSync(EarnValidatorKey);

const EarnValidatorWire = Schema.Struct({
  ...YieldApi.ValidatorDto.fields,
  address: ValidatorAddress,
  providerId: Schema.optionalKey(ProviderId),
});

export const EarnValidator = EarnValidatorWire.pipe(
  Schema.extendTo(
    { key: EarnValidatorKey },
    {
      key: (validator) =>
        Option.some(
          makeEarnValidatorKey(
            validator.subnet?.id === undefined
              ? validator.address
              : `${validator.address}:${validator.subnet.id}`
          )
        ),
    }
  )
);
export type EarnValidator = typeof EarnValidator.Type;

export const EarnYield = Schema.Struct({
  ...YieldApi.YieldDto.fields,
  id: YieldId,
  providerId: ProviderId,
  inputTokens: Schema.Array(EarnToken),
  outputToken: Schema.optionalKey(EarnToken),
  token: EarnToken,
});
export type EarnYield = typeof EarnYield.Type;

export const EarnYieldWithProvider = Schema.Struct({
  ...EarnYield.fields,
  provider: Schema.optionalKey(EarnProvider),
});
export type EarnYieldWithProvider = typeof EarnYieldWithProvider.Type;

export const EarnBalance = Schema.Struct({
  ...YieldApi.BalanceDto.fields,
  amount: PrecisionDecimalFromString,
  amountRaw: BigIntFromString,
  amountUsd: Schema.optionalKey(Schema.NullOr(PrecisionDecimalFromString)),
  pendingActions: Schema.Array(PendingAction),
  token: EarnToken,
  validator: Schema.optionalKey(EarnValidator),
  validators: Schema.optionalKey(Schema.Array(EarnValidator)),
});
export type EarnBalance = typeof EarnBalance.Type;

export const EarnPosition = Schema.Struct({
  ...YieldApi.YieldBalancesDto.fields,
  yieldId: YieldId,
  balances: Schema.Array(EarnBalance),
  outputTokenBalance: Schema.optionalKey(Schema.NullOr(EarnBalance)),
});
export type EarnPosition = typeof EarnPosition.Type;

export const EarnYieldBalancesResponse = Schema.Struct({
  ...YieldApi.YieldBalancesDto.fields,
  yieldId: YieldId,
  balances: TolerantTopLevelArray(EarnBalance, {
    operation: "yield-balances",
  }),
  outputTokenBalance: Schema.optionalKey(Schema.NullOr(EarnBalance)),
});
export type EarnYieldBalancesResponse = typeof EarnYieldBalancesResponse.Type;

const YieldIdentifier = Schema.Struct({ id: Schema.String }).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => value.id),
    encode: SchemaGetter.forbidden(() => "Yield identifier is decode-only"),
  })
);

const ValidatorIdentifier = Schema.Struct({ address: Schema.String }).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => value.address),
    encode: SchemaGetter.forbidden(() => "Validator identifier is decode-only"),
  })
);

export const makeEarnYieldPage = (operation: string) =>
  Schema.Struct({
    ...YieldApi.YieldsControllerGetYields200.fields,
    items: Schema.optionalKey(
      TolerantTopLevelArray(EarnYield, {
        operation,
        identifier: YieldIdentifier,
      })
    ),
  });

export const EarnYieldPage = makeEarnYieldPage("earn-yield-catalog");

const EarnTokenWithAvailableYields = Schema.Struct({
  token: EarnToken,
  availableYields: Schema.Array(YieldId),
});

const EarnTokenWithAvailableYieldItems = TolerantTopLevelArray(
  EarnTokenWithAvailableYields,
  { operation: "default-token-options" }
);

export const EarnTokenPage = Schema.Struct({
  ...YieldApi.TokensControllerGetTokens200.fields,
  items: Schema.optionalKey(EarnTokenWithAvailableYieldItems),
});

export const EarnLegacyTokenOptionsResponse = EarnTokenWithAvailableYieldItems;

const EarnTokenBalance = Schema.Struct({
  ...EarnTokenWithAvailableYields.fields,
  amount: PrecisionDecimalFromString,
});

export const EarnTokenBalancesResponse = TolerantTopLevelArray(
  EarnTokenBalance,
  { operation: "token-balances-scan" }
);

const EarnValidatorItems = TolerantTopLevelArray(EarnValidator, {
  operation: "validators",
  identifier: ValidatorIdentifier,
});

export const EarnValidatorPage = Schema.Struct({
  ...YieldApi.YieldsControllerGetYieldValidators200.fields,
  items: Schema.optionalKey(EarnValidatorItems),
});

export const EarnPositionsResponse = Schema.Struct({
  ...YieldApi.BalancesResponseDto.fields,
  items: TolerantTopLevelArray(EarnPosition, {
    operation: "positions-data",
  }),
});
