import { Effect, Schema, SchemaGetter, SchemaTransformation } from "effect";
import { YieldId } from "../../domain/identity/identifiers";
import { Network } from "../../domain/network/network";
import { HostTokenKey } from "../../domain/token/token";
import {
  isWalletNetwork,
  type WalletNetwork,
} from "../../domain/wallet/network";

const invalidAsNull = <S extends Schema.Constraint>(schema: S) =>
  Schema.NullOr(schema).pipe(
    Schema.catchDecoding(() => Effect.succeedSome(null))
  );

const SafeQueryParam = Schema.String.check(
  Schema.isPattern(/^(?!.*\.\.)[a-zA-Z0-9-_.+]*$/)
);

// Position balance keys (`default`, `validators`, `validator::<address>[:<subnet>]`)
// contain `:`, which is safe inside a route segment; `/`, `%`, `?` and `..` stay out.
const BalanceIdParam = Schema.String.check(
  Schema.isPattern(/^(?!.*\.\.)[a-zA-Z0-9-_.+:]*$/)
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
    Schema.declare<WalletNetwork>(
      (value): value is WalletNetwork =>
        typeof value === "string" && isWalletNetwork(value),
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

// Longest first, so `avalanche-c-0x…` resolves to `avalanche-c`, not a shorter
// network that happens to prefix it.
const networksLongestFirst = [...Network.literals].sort(
  (left, right) => right.length - left.length
);

/** The network a `${network}-${address}` reference starts with, in any case. */
const networkPrefix = (token: string) => {
  const lower = token.toLowerCase();
  return (
    networksLongestFirst.find((network) => lower.startsWith(`${network}-`)) ??
    null
  );
};

/**
 * The `token` parameter: a host token key when it starts with a network,
 * otherwise a symbol that needs the `network` parameter to resolve.
 */
const InitTokenReference = Schema.Union([
  Schema.TaggedStruct("HostKey", { key: HostTokenKey }),
  Schema.TaggedStruct("Symbol", { symbol: Schema.NonEmptyString }),
]);
export type InitToken = typeof InitTokenReference.Type;

const InitToken = Schema.String.pipe(
  Schema.decodeTo(
    InitTokenReference,
    SchemaTransformation.transform({
      // The union applies the `HostTokenKey` brand after this step.
      decode: (token): typeof InitTokenReference.Encoded =>
        networkPrefix(token) === null
          ? { _tag: "Symbol", symbol: token }
          : { _tag: "HostKey", key: token },
      encode: (reference) =>
        reference._tag === "HostKey" ? reference.key : reference.symbol,
    })
  )
);

export const InitParams = Schema.Struct({
  accountId: invalidAsNull(AccountId),
  balanceId: invalidAsNull(BalanceIdParam),
  network: invalidAsNull(SupportedNetwork),
  pendingaction: invalidAsNull(PendingActionType),
  tab: InitTab,
  token: invalidAsNull(InitToken),
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
    network: url.searchParams.get("network") ?? (token && networkPrefix(token)),
    pendingaction: url.searchParams.get("pendingaction"),
    tab: url.searchParams.get("tab"),
    token,
    validator: url.searchParams.get("validator"),
    yieldId: url.searchParams.get("yieldId"),
  });
};
