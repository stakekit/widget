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
import { TolerantArray, TolerantNullOr } from "../decoding/response-schema";
import {
  ExactBaseUnitAmount,
  ExactDecimal,
  TolerantOptionalUtcDateTimeFromString,
} from "../finance/scalars";
import { YieldId } from "../identity/identifiers";
import { Token } from "../token/token";
import { PendingAction } from "./action-models";
import { EarnValidator } from "./validator";
import { EarnRewardRate, TolerantExactDecimal } from "./wire-fields";

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
    Schema.TemplateLiteral(["0x", Schema.String])
      .check(Schema.isPattern(/^0x[0-9a-f]{64}$/))
      .pipe(Schema.brand("ConfidentialHandle"))
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
  isEarning: Schema.optionalKey(
    TolerantNullOr(Schema.Boolean, {
      operation: "yield-balance",
      field: "isEarning",
    })
  ),
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
    decode: SchemaGetter.transformEffect((wire, options) => {
      const balance = Struct.omit(wire, ["shareAmount", "shareAmountRaw"]);
      return decodeBalanceShares(wire, options).pipe(
        Effect.map((shares) =>
          shares === null ? balance : { ...balance, shares }
        )
      );
    }),
    encode: SchemaGetter.forbidden(
      () => "Decoded Earn balances are decode-only"
    ),
  })
);
export type EarnBalance = typeof EarnBalance.Type;
export type YieldBalanceType = EarnBalance["type"];

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
