import BigNumber from "bignumber.js";
import { Effect, Option, Schema, SchemaGetter, SchemaParser } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { PendingAction } from "../action/models";
import { TronResource } from "../action/tron-resource";
import { TolerantTopLevelArray } from "../decoding/response-schema";
import {
  BigIntFromString,
  PrecisionDecimalFromString,
  TolerantOptionalUtcDateTimeFromString,
} from "../finance/scalars";
import {
  ProviderId,
  TokenAddress,
  ValidatorAddress,
  YieldId,
} from "../identity/identifiers";
import { Token } from "../token/token";

const EarnReward = Schema.Struct({
  ...YieldApi.RewardDto.fields,
  token: Token,
});

const EarnRewardRate = Schema.Struct({
  ...YieldApi.YieldDto.fields.rewardRate.fields,
  components: Schema.Array(EarnReward),
});

type ApiArgumentField = typeof YieldApi.ArgumentFieldDto.Type;
type ApiArgumentName = ApiArgumentField["name"];
type ApiArgumentType = ApiArgumentField["type"];

const NumericArgumentBound = Schema.String.check(Schema.isStringFinite());

const hasCoherentAmountBounds = (
  minimumValue: string,
  maximumValue: string | null
) => {
  const minimum = new BigNumber(minimumValue);
  const maximum = maximumValue === null ? null : new BigNumber(maximumValue);

  if (minimum.isEqualTo(-1) || maximum?.isEqualTo(-1)) {
    return minimum.isEqualTo(-1) && maximum?.isEqualTo(-1) === true;
  }

  if (minimum.isNegative()) return false;
  if (maximum === null || maximum.isZero()) return true;

  return maximum.isGreaterThanOrEqualTo(minimum);
};

const normalizeAmountMaximum = (
  minimumValue: string,
  maximumValue: string | null
) =>
  maximumValue !== null &&
  new BigNumber(minimumValue).isGreaterThanOrEqualTo(0) &&
  new BigNumber(maximumValue).isEqualTo(-1)
    ? null
    : maximumValue;

const decodeApiArgument = <
  const Name extends ApiArgumentName,
  const Type extends ApiArgumentType,
  Domain extends Schema.Constraint,
  R,
>(
  name: Name,
  type: Type,
  domain: Domain,
  decode: SchemaGetter.Getter<Domain["Encoded"], ApiArgumentField, R>
) =>
  YieldApi.ArgumentFieldDto.check(
    Schema.makeFilter((field) =>
      field.name === name && field.type === type
        ? true
        : `expected ${name} mechanic argument with type ${type}`
    )
  ).pipe(
    Schema.decodeTo(domain, {
      decode,
      encode: SchemaGetter.forbidden(
        () => "Resolved Earn mechanic arguments are decode-only"
      ),
    })
  );

const AmountArgumentDomain = Schema.Struct({
  required: Schema.Boolean,
  minimum: NumericArgumentBound,
  maximum: Schema.NullOr(NumericArgumentBound),
}).check(
  Schema.makeFilter((field) =>
    hasCoherentAmountBounds(field.minimum, field.maximum)
      ? true
      : "amount bounds must form a coherent non-negative range or the -1/-1 force-max pair"
  )
);

const AmountArgument = decodeApiArgument(
  "amount",
  "string",
  AmountArgumentDomain,
  SchemaGetter.transform<typeof AmountArgumentDomain.Encoded, ApiArgumentField>(
    (field) => {
      const minimum = field.minimum ?? "0";

      return {
        maximum: normalizeAmountMaximum(minimum, field.maximum ?? null),
        minimum,
        required: field.required ?? false,
      };
    }
  )
);

const makeRequiredOptionsFilter = (name: ApiArgumentName) =>
  Schema.makeFilter<{
    readonly required: boolean;
    readonly options: readonly unknown[];
  }>((field) =>
    !field.required || field.options.length > 0
      ? true
      : `required ${name} arguments must advertise at least one option`
  );

const ProviderIdArgumentDomain = Schema.Struct({
  required: Schema.Boolean,
  options: Schema.Array(YieldId),
}).check(makeRequiredOptionsFilter("providerId"));

const ProviderIdArgument = decodeApiArgument(
  "providerId",
  "string",
  ProviderIdArgumentDomain,
  SchemaGetter.transform<
    typeof ProviderIdArgumentDomain.Encoded,
    ApiArgumentField
  >((field) => ({
    options: field.options ?? [],
    required: field.required ?? false,
  }))
);

const OutputTokenArgumentDomain = Schema.Struct({
  required: Schema.Boolean,
  options: Schema.Array(TokenAddress),
}).check(makeRequiredOptionsFilter("outputToken"));

const OutputTokenArgument = decodeApiArgument(
  "outputToken",
  "string",
  OutputTokenArgumentDomain,
  SchemaGetter.transform<
    typeof OutputTokenArgumentDomain.Encoded,
    ApiArgumentField
  >((field) => ({
    options: field.options ?? [],
    required: field.required ?? false,
  }))
);

const TronResourceOptions = Schema.Array(TronResource);

const TronResourceArgumentDomain = Schema.Struct({
  required: Schema.Boolean,
  options: TronResourceOptions,
}).check(makeRequiredOptionsFilter("tronResource"));

const TronResourceArgument = decodeApiArgument(
  "tronResource",
  "enum",
  TronResourceArgumentDomain,
  SchemaGetter.transformOrFail<
    typeof TronResourceArgumentDomain.Encoded,
    ApiArgumentField
  >((field, options) =>
    SchemaParser.decodeUnknownEffect(TronResourceOptions)(
      field.options ?? [],
      options
    ).pipe(
      Effect.map((tronResources) => ({
        options: tronResources,
        required: field.required ?? false,
      }))
    )
  )
);

const makeRequiredArgument = <
  const Name extends ApiArgumentName,
  const Type extends ApiArgumentType,
>(
  name: Name,
  type: Type
) => {
  const domain = Schema.Struct({
    required: Schema.Boolean,
  });

  return decodeApiArgument(
    name,
    type,
    domain,
    SchemaGetter.transform<typeof domain.Encoded, ApiArgumentField>(
      (field) => ({ required: field.required ?? false })
    )
  );
};

const ValidatorAddressArgument = makeRequiredArgument(
  "validatorAddress",
  "string"
);
const ValidatorAddressesArgument = makeRequiredArgument(
  "validatorAddresses",
  "string"
);
const SubnetIdArgument = makeRequiredArgument("subnetId", "number");

const EarnYieldArgumentFieldsDomain = Schema.Struct({
  amount: Schema.optionalKey(AmountArgument),
  outputToken: Schema.optionalKey(OutputTokenArgument),
  providerId: Schema.optionalKey(ProviderIdArgument),
  subnetId: Schema.optionalKey(SubnetIdArgument),
  tronResource: Schema.optionalKey(TronResourceArgument),
  validatorAddress: Schema.optionalKey(ValidatorAddressArgument),
  validatorAddresses: Schema.optionalKey(ValidatorAddressesArgument),
});

const EarnYieldArgumentFields = Schema.Array(YieldApi.ArgumentFieldDto).pipe(
  Schema.decodeTo(EarnYieldArgumentFieldsDomain, {
    decode: SchemaGetter.transform((fields) =>
      Object.fromEntries(fields.map((field) => [field.name, field]))
    ),
    encode: SchemaGetter.forbidden(
      () => "Resolved Earn mechanic arguments are decode-only"
    ),
  })
);

const EarnYieldActionArguments = Schema.Struct({
  fields: EarnYieldArgumentFields,
});

const EarnYieldArguments = Schema.Struct({
  enter: Schema.optionalKey(EarnYieldActionArguments),
  exit: Schema.optionalKey(EarnYieldActionArguments),
  manage: Schema.optionalKey(
    Schema.Record(Schema.String, EarnYieldActionArguments)
  ),
  balance: Schema.optionalKey(EarnYieldActionArguments),
});

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
  rewardRate: Schema.optionalKey(EarnRewardRate),
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
  inputTokens: Schema.Array(Token),
  mechanics: Schema.Struct({
    ...YieldApi.YieldDto.fields.mechanics.fields,
    arguments: Schema.optionalKey(EarnYieldArguments),
    gasFeeToken: Token,
  }),
  outputToken: Schema.optionalKey(Token),
  rewardRate: EarnRewardRate,
  token: Token,
  tokens: Schema.Array(Token),
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
  date: Schema.optionalKey(
    TolerantOptionalUtcDateTimeFromString({
      operation: "yield-balance",
      field: "date",
    })
  ),
  pendingActions: Schema.Array(PendingAction),
  token: Token,
  validator: Schema.optionalKey(EarnValidator),
  validators: Schema.optionalKey(Schema.Array(EarnValidator)),
});
export type EarnBalance = typeof EarnBalance.Type;

export const EarnPosition = Schema.Struct({
  ...YieldApi.YieldBalancesDto.fields,
  yieldId: YieldId,
  balances: Schema.Array(EarnBalance),
  outputTokenBalance: Schema.optionalKey(Schema.NullOr(EarnBalance)),
  rewardRate: Schema.optionalKey(Schema.NullOr(EarnRewardRate)),
});
export type EarnPosition = typeof EarnPosition.Type;

export const EarnYieldBalancesResponse = Schema.Struct({
  ...YieldApi.YieldBalancesDto.fields,
  yieldId: YieldId,
  balances: TolerantTopLevelArray(EarnBalance, {
    operation: "yield-balances",
  }),
  outputTokenBalance: Schema.optionalKey(Schema.NullOr(EarnBalance)),
  rewardRate: Schema.optionalKey(Schema.NullOr(EarnRewardRate)),
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

const makeEarnYieldPage = (operation: string) =>
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
  token: Token,
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
