import {
  Effect,
  Option,
  Predicate,
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
  ProviderOption,
  TokenAddress,
  ValidatorAddress,
  YieldId,
} from "../identity/identifiers";
import { Token } from "../token/token";

// `yieldSource` stays open: reward-rate breakdowns already fall back for
// sources they do not group.
const EarnReward = Schema.Struct({
  ...Struct.pick(YieldApi.RewardDto.fields, ["rateType"]),
  rate: ExactDecimal,
  token: Token,
  yieldSource: Schema.String,
});

const EarnRewardRate = Schema.Struct({
  ...Struct.pick(YieldApi.RewardRateDto.fields, ["rateType"]),
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
  ...Struct.pick(YieldApi.ArgumentFieldDto.fields, ["required", "options"]),
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

// Arguments the enter and exit action builders actually supply (including
// wallet-derived additional addresses). A required argument outside this set
// would produce an action the API rejects, so the yield is unsupported.
const SupportedActionArguments: Record<
  "enter" | "exit",
  Partial<Record<ApiArgumentName, true>>
> = {
  enter: {
    amount: true,
    inputToken: true,
    useMaxAmount: true,
    ledgerWalletApiCompatible: true,
    tronResource: true,
    providerId: true,
    validatorAddress: true,
    validatorAddresses: true,
    subnetId: true,
    cosmosPubKey: true,
    encryptedAmount: true,
    encryptedAmountProof: true,
    encryptedLegAmounts: true,
    encryptedLegProof: true,
  },
  exit: {
    amount: true,
    outputToken: true,
    useMaxAmount: true,
    tronResource: true,
    providerId: true,
    validatorAddress: true,
    validatorAddresses: true,
    subnetId: true,
    cosmosPubKey: true,
    encryptedAmount: true,
    encryptedAmountProof: true,
    encryptedLegAmounts: true,
    encryptedLegProof: true,
    shareAmountRaw: true,
  },
};

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
  options: Schema.Array(ProviderOption),
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
const EncryptedAmountArgumentDomain = Schema.Struct({
  required: Schema.Boolean,
  options: Schema.Array(Schema.String),
});

const EncryptedAmountArgument = decodeApiArgument(
  "encryptedAmount",
  "string",
  EncryptedAmountArgumentDomain,
  SchemaGetter.transform<
    typeof EncryptedAmountArgumentDomain.Encoded,
    ApiArgumentField
  >((field) => ({
    options: field.options ?? [],
    required: field.required ?? false,
  }))
);

const EncryptedLegAmountsArgumentDomain = Schema.Struct({
  required: Schema.Boolean,
  options: Schema.Array(Schema.String),
}).check(makeRequiredOptionsFilter("encryptedLegAmounts"));

const EncryptedLegAmountsArgument = decodeApiArgument(
  "encryptedLegAmounts",
  "string",
  EncryptedLegAmountsArgumentDomain,
  SchemaGetter.transform<
    typeof EncryptedLegAmountsArgumentDomain.Encoded,
    ApiArgumentField
  >((field) => ({
    options: field.options ?? [],
    required: field.required ?? false,
  }))
);

const EarnYieldArgumentFieldsDomain = Schema.Struct({
  amount: Schema.optionalKey(AmountArgument),
  encryptedAmount: Schema.optionalKey(EncryptedAmountArgument),
  encryptedLegAmounts: Schema.optionalKey(EncryptedLegAmountsArgument),
  outputToken: Schema.optionalKey(OutputTokenArgument),
  providerId: Schema.optionalKey(ProviderIdArgument),
  subnetId: Schema.optionalKey(SubnetIdArgument),
  tronResource: Schema.optionalKey(TronResourceArgument),
  validatorAddress: Schema.optionalKey(ValidatorAddressArgument),
  validatorAddresses: Schema.optionalKey(ValidatorAddressesArgument),
});

const makeEarnYieldActionArguments = (
  isSupported: (field: ApiArgumentField) => boolean,
  scope: string
) =>
  Schema.Struct({
    fields: Schema.Array(ArgumentField).pipe(
      Schema.check(
        Schema.makeFilter((fields) => {
          const unsupported = fields.find(
            (field) => field.required && !isSupported(field)
          );

          return unsupported
            ? `required ${scope} argument ${unsupported.name} is not supported`
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
    ),
  });

const makeBuiltActionArguments = (action: "enter" | "exit") =>
  makeEarnYieldActionArguments(
    (field) =>
      isKnownArgument(field) &&
      SupportedActionArguments[action][field.name] === true,
    action
  );

// Manage and balance arguments are not built by the widget's enter/exit flows;
// they only require a name and type the generated client knows.
const KnownActionArguments = makeEarnYieldActionArguments(
  isKnownArgument,
  "mechanic"
);

const EarnYieldArguments = Schema.Struct({
  enter: Schema.optionalKey(makeBuiltActionArguments("enter")),
  exit: Schema.optionalKey(makeBuiltActionArguments("exit")),
  manage: Schema.optionalKey(
    Schema.Record(Schema.String, KnownActionArguments)
  ),
  balance: Schema.optionalKey(KnownActionArguments),
});

// Provider `type` is not picked, so new provider kinds stay decodable.
export const EarnProvider = Schema.Struct({
  ...Struct.pick(YieldApi.ProviderDto.fields, [
    "name",
    "logoURI",
    "website",
    "tvlUsd",
  ]),
  id: ProviderId,
});
export type EarnProvider = typeof EarnProvider.Type;

export const EarnValidatorKey = Schema.NonEmptyString.pipe(
  Schema.brand("EarnValidatorKey")
);
export type EarnValidatorKey = typeof EarnValidatorKey.Type;

const makeEarnValidatorKey = Schema.decodeSync(EarnValidatorKey);

const EarnValidatorWire = Schema.Struct({
  ...Struct.pick(YieldApi.ValidatorDto.fields, [
    "name",
    "logoURI",
    "website",
    "commission",
    "tvl",
    "tvlRaw",
    "votingPower",
    "preferred",
    "nominatorCount",
    "status",
    "subnet",
  ]),
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

// Only the metadata the widget reads is picked, so values the API adds to
// unread enums cannot reject an otherwise usable yield.
const EarnYieldMetadata = YieldApi.YieldMetadataDto.mapFields(
  Struct.pick(["name", "logoURI", "description", "documentation"])
);

const EarnYieldRequirements = Schema.Struct({
  ...Struct.pick(YieldApi.YieldRequirementsDto.fields, ["kycRequired"]),
  kyc: Schema.optionalKey(
    YieldApi.KycMetadataDto.mapFields(
      Struct.pick(["iframeAllowed", "authorizeUrl"])
    )
  ),
});

const EarnYieldState = YieldApi.YieldStateDto.mapFields(
  Struct.pick(["pricePerShareState"])
);

const EarnYieldRisk = Schema.Struct({
  ratings: Schema.Array(
    Schema.Struct({
      ...Struct.pick(YieldApi.YieldRiskEntryDto.fields, ["rating"]),
      source: Schema.String,
    })
  ),
});

const EarnScheduleWindow = Schema.Struct({
  closesAt: Schema.String,
  opensAt: Schema.String,
});

// Cadence and status stay open so new API values only disable batch timing.
const EarnSchedulePath = Schema.Struct({
  ...Struct.pick(YieldApi.SchedulePathDto.fields, [
    "businessDaysOnly",
    "cutoffTime",
  ]),
  cadence: Schema.String,
  currentWindow: Schema.optionalKey(Schema.NullOr(EarnScheduleWindow)),
  nextWindow: Schema.optionalKey(Schema.NullOr(EarnScheduleWindow)),
  kind: Schema.String,
  status: Schema.String,
});

const EarnScheduleSide = Schema.Struct({
  paths: Schema.Array(EarnSchedulePath),
});

const EarnInvestmentSchedule = Schema.Struct({
  redemption: EarnScheduleSide,
  subscription: EarnScheduleSide,
  timezone: Schema.String,
});
export type EarnInvestmentSchedule = typeof EarnInvestmentSchedule.Type;

export const EarnYield = Schema.Struct({
  ...Struct.pick(YieldApi.YieldDto.fields, ["network", "statistics", "status"]),
  // Malformed contracts leave the yield non-confidential.
  executionContracts: Schema.optionalKey(
    TolerantNullOr(YieldApi.ExecutionContractsDto, {
      operation: "yield",
      field: "executionContracts",
    })
  ),
  id: YieldId,
  providerId: ProviderId,
  inputTokens: EarnYieldTokens,
  // A malformed schedule only drops batch timing.
  investmentSchedule: Schema.optionalKey(
    TolerantNullOr(EarnInvestmentSchedule, {
      operation: "yield",
      field: "investmentSchedule",
    })
  ),
  mechanics: Schema.Struct({
    ...Struct.pick(YieldApi.YieldMechanicsDto.fields, [
      "type",
      "requiresValidatorSelection",
      "rewardSchedule",
      "rewardClaiming",
      "lockupPeriod",
      "cooldownPeriod",
      "warmupPeriod",
      "fee",
      "entryLimits",
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

// The API sends `null` for absent validator metadata; normalizing it to an
// absent key keeps a single "not present" representation for consumers.
const OptionalKeyFromNullOr = <S extends Schema.Top>(schema: S) =>
  Schema.optionalKey(Schema.NullOr(schema)).pipe(
    Schema.decodeTo(Schema.optionalKey(Schema.toType(schema)), {
      decode: SchemaGetter.transformOptional(
        Option.filter(Predicate.isNotNull)
      ),
      encode: SchemaGetter.passthroughSubtype(),
    })
  );

export const EarnBalance = Schema.Struct({
  ...Struct.pick(YieldApi.BalanceDto.fields, [
    "address",
    "type",
    "isEncrypted",
    "shareAmount",
    "shareAmountRaw",
  ]),
  shareToken: Schema.optionalKey(Token),
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
  validator: OptionalKeyFromNullOr(EarnValidator),
  validators: OptionalKeyFromNullOr(
    TolerantArray(EarnValidator, { operation: "balance-validators" })
  ),
});
/**
 * `revealedHandle` is set by the widget, never by the API: the handle a
 * revealed balance was decrypted from, which its `shareAmountRaw` no longer holds.
 */
export type EarnBalance = typeof EarnBalance.Type & {
  readonly revealedHandle?: string;
};

export const EarnPosition = Schema.Struct({
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
