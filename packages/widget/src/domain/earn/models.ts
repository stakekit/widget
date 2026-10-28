import {
  Effect,
  Option,
  Predicate,
  Schema,
  type SchemaAST,
  SchemaGetter,
  SchemaParser,
  SchemaTransformation,
  Struct,
} from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { PendingAction } from "../action/models";
import { TronResource } from "../action/tron-resource";
import { TolerantArray, TolerantNullOr } from "../decoding/response-schema";
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

/**
 * An optional decimal the widget reads: a malformed value becomes `null` so
 * only that field is lost, never the model holding it.
 */
const TolerantExactDecimal = (operation: string, field: string) =>
  TolerantNullOr(ExactDecimal, { operation, field });

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
  minimum: ExactDecimal,
  maximum: ExactDecimal | null
) =>
  maximum !== null && minimum.isGreaterThanOrEqualTo(0) && maximum.isEqualTo(-1)
    ? null
    : maximum;

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

const AmountArgumentBounds = Schema.Struct({
  minimum: ExactDecimal,
  maximum: Schema.NullOr(ExactDecimal),
});

const AmountArgumentDomain = Schema.Struct({
  required: Schema.Boolean,
  minimum: Schema.toType(ExactDecimal),
  maximum: Schema.NullOr(Schema.toType(ExactDecimal)),
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
  SchemaGetter.transformEffect<
    typeof AmountArgumentDomain.Encoded,
    ApiArgumentField
  >((field, options) =>
    SchemaParser.decodeEffect(AmountArgumentBounds)(
      { maximum: field.maximum ?? null, minimum: field.minimum ?? "0" },
      options
    ).pipe(
      Effect.map(({ maximum, minimum }) => ({
        maximum: normalizeAmountMaximum(minimum, maximum),
        minimum,
        required: field.required ?? false,
      }))
    )
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
  ...Struct.pick(YieldApi.ProviderDto.fields, ["name", "logoURI", "website"]),
  id: ProviderId,
  tvlUsd: TolerantExactDecimal("yield-provider", "tvlUsd"),
});
export type EarnProvider = typeof EarnProvider.Type;

export const EarnValidatorKey = Schema.NonEmptyString.pipe(
  Schema.brand("EarnValidatorKey")
);
export type EarnValidatorKey = typeof EarnValidatorKey.Type;

const makeEarnValidatorKey = Schema.decodeSync(EarnValidatorKey);

// `tvlRaw` is not decoded: TVL is displayed in token units from `tvl`.
const EarnValidatorWire = Schema.Struct({
  ...Struct.pick(YieldApi.ValidatorDto.fields, [
    "name",
    "logoURI",
    "website",
    "commission",
    "votingPower",
    "preferred",
    "nominatorCount",
    "status",
    "subnet",
  ]),
  address: ValidatorAddress,
  providerId: Schema.optionalKey(ProviderId),
  rewardRate: Schema.optionalKey(EarnRewardRate),
  tvl: Schema.optionalKey(TolerantExactDecimal("yield-validator", "tvl")),
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

const EarnPricePerShareState = Schema.Struct({
  price: ExactDecimal,
  shareToken: Token,
});

// A malformed price-per-share state only drops share pricing.
const EarnYieldState = Schema.Struct({
  pricePerShareState: Schema.optionalKey(
    TolerantNullOr(EarnPricePerShareState, {
      operation: "yield-state",
      field: "pricePerShareState",
    })
  ),
});

// Only the statistics the widget reads are decoded; `tvl`/`tvlRaw` are unread.
const EarnYieldStatistics = Schema.Struct({
  ...Struct.pick(YieldApi.YieldStatisticsDto.fields, ["uniqueUsers"]),
  averagePositionSizeUsd: Schema.optionalKey(
    TolerantExactDecimal("yield-statistics", "averagePositionSizeUsd")
  ),
  tvlUsd: Schema.optionalKey(
    TolerantExactDecimal("yield-statistics", "tvlUsd")
  ),
});

// Fees are percentages; a malformed one drops only itself.
const EarnYieldFee = Schema.Struct({
  deposit: Schema.optionalKey(TolerantExactDecimal("yield-fee", "deposit")),
  management: Schema.optionalKey(
    TolerantExactDecimal("yield-fee", "management")
  ),
  performance: Schema.optionalKey(
    TolerantExactDecimal("yield-fee", "performance")
  ),
  withdrawal: Schema.optionalKey(
    TolerantExactDecimal("yield-fee", "withdrawal")
  ),
});

// Token-unit limits; a malformed limit reads as no limit.
const EarnYieldEntryLimits = Schema.Struct({
  maximum: TolerantExactDecimal("yield-entry-limits", "maximum"),
  minimum: TolerantExactDecimal("yield-entry-limits", "minimum"),
  subsequentMinimum: TolerantExactDecimal(
    "yield-entry-limits",
    "subsequentMinimum"
  ),
});

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
  ...Struct.pick(YieldApi.YieldDto.fields, ["network", "status"]),
  statistics: Schema.optionalKey(EarnYieldStatistics),
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
    ]),
    entryLimits: Schema.optionalKey(EarnYieldEntryLimits),
    fee: Schema.optionalKey(EarnYieldFee),
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

/** The ciphertext handle a confidential balance's shares are hidden behind. */
export const ConfidentialHandle = Schema.String.pipe(
  Schema.decode(SchemaTransformation.toLowerCase()),
  Schema.decodeTo(
    Schema.String.check(Schema.isPattern(/^0x[0-9a-f]{64}$/)).pipe(
      Schema.brand("ConfidentialHandle")
    )
  )
);
export type ConfidentialHandle = typeof ConfidentialHandle.Type;

/**
 * A balance's shares. The API sends an encrypted balance's handle where a
 * plain balance has its base-unit share count; a revealed balance holds the
 * decrypted count beside the handle it was decrypted from.
 */
export const EarnBalanceShares = Schema.TaggedUnion({
  Plain: {
    amount: Schema.optionalKey(Schema.toType(ExactDecimal)),
    amountRaw: Schema.optionalKey(Schema.BigInt),
  },
  Encrypted: { handle: Schema.toType(ConfidentialHandle) },
  Revealed: {
    amount: Schema.toType(ExactDecimal),
    amountRaw: Schema.BigInt,
    handle: Schema.toType(ConfidentialHandle),
  },
});
export type EarnBalanceShares = typeof EarnBalanceShares.Type;

export type BalanceShares = Readonly<{
  readonly shares?: EarnBalanceShares;
}>;

/** The handle a still-encrypted balance's shares are hidden behind. */
export const getEncryptedHandle = (
  balance: BalanceShares
): ConfidentialHandle | null =>
  balance.shares?._tag === "Encrypted" ? balance.shares.handle : null;

/** The share count a balance shows: plain from the API, or revealed. */
export const getVisibleShares = (balance: BalanceShares) =>
  balance.shares === undefined || balance.shares._tag === "Encrypted"
    ? null
    : balance.shares;

const PlainShareAmountRaw = TolerantNullOr(ExactBaseUnitAmount, {
  operation: "yield-balance",
  field: "shareAmountRaw",
});

const EncryptedShareHandle = TolerantNullOr(ConfidentialHandle, {
  operation: "yield-balance",
  field: "shareAmountRaw",
});

const EarnBalanceWire = Schema.Struct({
  ...Struct.pick(YieldApi.BalanceDto.fields, [
    "address",
    "type",
    "isEncrypted",
  ]),
  shareAmount: Schema.optionalKey(
    TolerantExactDecimal("yield-balance", "shareAmount")
  ),
  // Its meaning depends on `isEncrypted`, so the tolerant decoders below
  // check it; any wire value reaches them.
  shareAmountRaw: Schema.optionalKey(Schema.Unknown),
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

const EarnBalanceDomain = Schema.Struct({
  ...Struct.map(
    Struct.omit(EarnBalanceWire.fields, ["shareAmount", "shareAmountRaw"]),
    Schema.toType
  ),
  shares: Schema.optionalKey(EarnBalanceShares),
});

type EarnBalanceWire = typeof EarnBalanceWire.Type;

const decodeBalanceShares = (
  {
    isEncrypted,
    shareAmount,
    shareAmountRaw,
  }: Pick<EarnBalanceWire, "isEncrypted" | "shareAmount" | "shareAmountRaw">,
  options: SchemaAST.ParseOptions
) =>
  isEncrypted
    ? SchemaParser.decodeEffect(EncryptedShareHandle)(
        shareAmountRaw ?? null,
        options
      ).pipe(
        Effect.map((handle): EarnBalanceShares | null =>
          handle === null ? null : { _tag: "Encrypted", handle }
        )
      )
    : SchemaParser.decodeEffect(PlainShareAmountRaw)(
        shareAmountRaw ?? null,
        options
      ).pipe(
        Effect.map((amountRaw): EarnBalanceShares | null =>
          amountRaw === null && shareAmount == null
            ? null
            : {
                _tag: "Plain",
                ...(shareAmount == null ? {} : { amount: shareAmount }),
                ...(amountRaw === null ? {} : { amountRaw }),
              }
        )
      );

export const EarnBalance = EarnBalanceWire.pipe(
  Schema.decodeTo(EarnBalanceDomain, {
    decode: SchemaGetter.transformEffect(
      ({ shareAmount, shareAmountRaw, ...balance }, options) =>
        decodeBalanceShares(
          { isEncrypted: balance.isEncrypted, shareAmount, shareAmountRaw },
          options
        ).pipe(
          Effect.map((shares) =>
            shares === null ? balance : { ...balance, shares }
          )
        )
    ),
    encode: SchemaGetter.forbidden(
      () => "Decoded Earn balances are decode-only"
    ),
  })
);
export type EarnBalance = typeof EarnBalance.Type;

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
