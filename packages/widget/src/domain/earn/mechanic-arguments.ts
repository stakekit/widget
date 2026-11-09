import { Effect, Schema, SchemaGetter, SchemaParser, Struct } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { TronResource } from "../action/tron-resource";
import { ExactDecimal, ExactDecimalInput } from "../finance/scalars";
import {
  ContractAddress,
  ProviderOption,
  TokenAddress,
} from "../identity/identifiers";

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
// Only its presence matters: whether an exit takes a plain amount.
const AmountRawArgument = makeRequiredArgument("amountRaw", "string");
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
  options: Schema.Array(ContractAddress),
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
  amountRaw: Schema.optionalKey(AmountRawArgument),
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

export const EarnYieldArguments = Schema.Struct({
  enter: Schema.optionalKey(makeBuiltActionArguments("enter")),
  exit: Schema.optionalKey(makeBuiltActionArguments("exit")),
  manage: Schema.optionalKey(
    Schema.Record(Schema.String, KnownActionArguments)
  ),
  balance: Schema.optionalKey(KnownActionArguments),
});
