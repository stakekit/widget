import { Effect, Option, Schema, SchemaGetter } from "effect";
import { YieldId } from "../../domain/identity/identifiers";
import { Network } from "../../domain/network/network";
import { isSupportedChain, type SupportedSKChains } from "./supported-chains";

const invalidAsNull = <S extends Schema.Constraint>(schema: S) =>
  Schema.NullOr(schema).pipe(
    Schema.catchDecoding(() => Effect.succeed(Option.some(null)))
  );

const SafeQueryParam = Schema.String.check(
  Schema.isPattern(/^(?!.*\.\.)[a-zA-Z0-9-_.+]*$/)
);

const PendingActionType = SafeQueryParam.check(Schema.isPattern(/^[A-Z_]+$/));

const InitTab = invalidAsNull(
  Schema.Literals(["earn", "positions", "manage", "activity", "borrow"])
);
export type InitTab = typeof InitTab.Type;

const SafeYieldId = SafeQueryParam.check(
  Schema.isPattern(/^[^-]+-[^-]+-.+$/)
).pipe(Schema.decodeTo(YieldId));

const SupportedNetwork = Network.pipe(
  Schema.decodeTo(
    Schema.declare<SupportedSKChains>(
      (value): value is SupportedSKChains =>
        typeof value === "string" && isSupportedChain(value),
      { expected: "a widget-supported network" }
    )
  )
);

const AccountId = Schema.String.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.decodeUriComponent(),
    encode: SchemaGetter.encodeUriComponent(),
  })
);

export const InitParams = Schema.Struct({
  accountId: invalidAsNull(AccountId),
  balanceId: invalidAsNull(SafeQueryParam),
  network: invalidAsNull(SupportedNetwork),
  pendingaction: invalidAsNull(PendingActionType),
  tab: InitTab,
  token: invalidAsNull(Schema.String),
  validator: invalidAsNull(Schema.String),
  yieldId: invalidAsNull(SafeYieldId),
});
export type InitParams = typeof InitParams.Type;

export const decodeInitParams = ({
  externalProviderInitToken,
  href,
}: {
  readonly externalProviderInitToken: string | null | undefined;
  readonly href: string;
}): InitParams => {
  const url = new URL(href);
  const token =
    url.searchParams.get("token") ?? externalProviderInitToken ?? null;

  return Schema.decodeUnknownSync(InitParams)({
    accountId: url.searchParams.get("accountId"),
    balanceId: url.searchParams.get("balanceId"),
    network:
      url.searchParams.get("network") ??
      (token?.includes("-") ? token.split("-").slice(0, -1).join("-") : null),
    pendingaction: url.searchParams.get("pendingaction"),
    tab: url.searchParams.get("tab"),
    token,
    validator: url.searchParams.get("validator"),
    yieldId: url.searchParams.get("yieldId"),
  });
};
