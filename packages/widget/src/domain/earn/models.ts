import {
  Effect,
  Option,
  Schema,
  SchemaGetter,
  SchemaParser,
  Struct,
} from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { PendingAction } from "../action/models";
import { TronResource } from "../action/tron-resource";
import { TolerantArray, TolerantNullOr } from "../decoding/response-schema";
import { exactDecimal } from "../finance/exact";
import {
  ExactBaseUnitAmount,
  ExactDecimal,
  ExactDecimalInput,
  TolerantOptionalUtcDateTimeFromString,
} from "../finance/scalars";
import {
  ProviderId,
  TokenAddress,
  ValidatorAddress,
  YieldId,
} from "../identity/identifiers";
import { Token } from "../token/token";

// `yieldSource` stays open: reward-rate breakdowns already fall back for
// sources they do not group.
const EarnReward = Schema.Struct({
  ...YieldApi.RewardDto.fields,
  rate: ExactDecimal,
  token: Token,
  yieldSource: Schema.String,
});

const EarnRewardRate = Schema.Struct({
  ...YieldApi.RewardRateDto.fields,
  components: TolerantArray(EarnReward, {
    operation: "reward-rate-components",
  }),
  total: ExactDecimal,
});

const EarnYieldTokens = TolerantArray(Token, { operation: "yield-tokens" });

type ApiArgumentField = typeof ArgumentField.Type;
type ApiArgumentName = YieldApi.ArgumentFieldDto["name"];
type ApiArgumentType = YieldApi.ArgumentFieldDto["type"];

// Argument names and types stay open so arguments added to the API after the
// client was generated do not reject the yield unless they are required.
const ArgumentField = Schema.Struct({
  ...YieldApi.ArgumentFieldDto.fields,
  maximum: Schema.optionalKey(Schema.NullOr(ExactDecimalInput)),
  minimum: Schema.optionalKey(Schema.NullOr(ExactDecimalInput)),
  name: Schema.String,
  type: Schema.String,
});

// A required argument must use a name and type the generated client knows;
// otherwise the widget cannot supply it and the yield is rejected.
const isKnownArgument = Schema.is(
  YieldApi.ArgumentFieldDto.mapFields(Struct.pick(["name", "type"]))
);

const hasCoherentAmountBounds = (
  minimumValue: ExactDecimal,
  maximumValue: ExactDecimal | null
) => {
  if (minimumValue.isEqualTo(-1) || maximumValue?.isEqualTo(-1)) {
    return minimumValue.isEqualTo(-1) && maximumValue?.isEqualTo(-1) === true;
  }

  if (minimumValue.isNegative()) return false;
  if (maximumValue === null || maximumValue.isZero()) return true;

  return maximumValue.isGreaterThanOrEqualTo(minimumValue);
};

const normalizeAmountMaximum = (
  minimumValue: string | number,
  maximumValue: string | number | null
) => {
  const minimum = exactDecimal(minimumValue);
  const maximum = maximumValue === null ? null : exactDecimal(maximumValue);

  return maximum !== null &&
    minimum.isGreaterThanOrEqualTo(0) &&
    maximum.isEqualTo(-1)
    ? null
    : maximumValue;
};

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
  ArgumentField.check(
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
  minimum: ExactDecimal,
  maximum: Schema.NullOr(ExactDecimal),
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
  SchemaGetter.transformEffect<
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

const EarnYieldArgumentFields = Schema.Array(ArgumentField).pipe(
  Schema.check(
    Schema.makeFilter((fields) => {
      const unsupported = fields.find(
        (field) => field.required && !isKnownArgument(field)
      );

      return unsupported
        ? `required mechanic argument ${unsupported.name} is not supported`
        : true;
    })
  ),
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

// Provider `type` is unread; omitting it keeps new provider kinds decodable.
export const EarnProvider = Schema.Struct({
  ...Struct.omit(YieldApi.ProviderDto.fields, ["type"]),
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
  provider: Schema.optionalKey(
    YieldApi.ValidatorProviderDto.mapFields(Struct.omit(["type"]))
  ),
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

// Unread metadata is not decoded, so values the API adds to those enums cannot
// reject an otherwise usable yield.
const EarnYieldMetadata = YieldApi.YieldMetadataDto.mapFields(
  Struct.omit(["supportedStandards"])
);

const EarnYieldRequirements = Schema.Struct({
  ...YieldApi.YieldRequirementsDto.fields,
  kyc: Schema.optionalKey(
    YieldApi.KycMetadataDto.mapFields(Struct.omit(["kycMode", "eligibility"]))
  ),
});

const EarnYieldState = YieldApi.YieldStateDto.mapFields(
  Struct.omit(["allocations"])
);

const EarnYieldRisk = Schema.Struct({
  ratings: Schema.Array(
    Schema.Struct({
      ...YieldApi.YieldRiskEntryDto.fields,
      source: Schema.String,
    })
  ),
});

export const EarnYield = Schema.Struct({
  ...Struct.omit(YieldApi.YieldDto.fields, ["investmentSchedule"]),
  id: YieldId,
  providerId: ProviderId,
  inputTokens: EarnYieldTokens,
  mechanics: Schema.Struct({
    ...Struct.omit(YieldApi.YieldMechanicsDto.fields, [
      "extraTransactionFormatsSupported",
    ]),
    arguments: Schema.optionalKey(EarnYieldArguments),
    gasFeeToken: Token,
    requirements: Schema.optionalKey(EarnYieldRequirements),
  }),
  metadata: EarnYieldMetadata,
  outputToken: Schema.optionalKey(Token),
  rewardRate: EarnRewardRate,
  risk: Schema.optionalKey(EarnYieldRisk),
  state: Schema.optionalKey(EarnYieldState),
  token: Token,
  tokens: EarnYieldTokens,
});
export type EarnYield = typeof EarnYield.Type;

export const EarnYieldWithProvider = Schema.Struct({
  ...EarnYield.fields,
  provider: Schema.optionalKey(EarnProvider),
});
export type EarnYieldWithProvider = typeof EarnYieldWithProvider.Type;

export const EarnBalance = Schema.Struct({
  ...YieldApi.BalanceDto.fields,
  amount: ExactDecimal,
  amountRaw: ExactBaseUnitAmount,
  amountUsd: Schema.optionalKey(Schema.NullOr(ExactDecimal)),
  date: Schema.optionalKey(
    TolerantOptionalUtcDateTimeFromString({
      operation: "yield-balance",
      field: "date",
    })
  ),
  pendingActions: TolerantArray(PendingAction, {
    operation: "balance-pending-actions",
  }),
  token: Token,
  validator: Schema.optionalKey(EarnValidator),
  validators: Schema.optionalKey(
    TolerantArray(EarnValidator, { operation: "balance-validators" })
  ),
});
export type EarnBalance = typeof EarnBalance.Type;

export const EarnPosition = Schema.Struct({
  ...YieldApi.YieldBalancesDto.fields,
  yieldId: YieldId,
  balances: TolerantArray(EarnBalance, {
    operation: "yield-balances",
  }),
  outputTokenBalance: Schema.optionalKey(
    TolerantNullOr(EarnBalance, {
      operation: "yield-balances",
      field: "outputTokenBalance",
    })
  ),
  rewardRate: Schema.optionalKey(Schema.NullOr(EarnRewardRate)),
});
export type EarnPosition = typeof EarnPosition.Type;

export const EarnYieldBalancesResponse = EarnPosition;
export type EarnYieldBalancesResponse = EarnPosition;

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
  ...YieldApi.YieldsControllerGetYieldValidators200.fields,
  items: Schema.optionalKey(EarnValidatorItems),
});

export const EarnPositionsResponse = Schema.Struct({
  ...YieldApi.BalancesResponseDto.fields,
  items: TolerantArray(EarnPosition, {
    operation: "positions-data",
  }),
});
