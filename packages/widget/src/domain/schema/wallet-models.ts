import { Schema, SchemaTransformation } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
import { isSupportedChain, type SupportedSKChains } from "../types/chains";
import { EarnYield } from "./earn-models";
import { YieldId } from "./identifiers";
import { Network } from "./network-model";

const EnabledNetworkArray = LegacyApi.YieldControllerGetMyNetworksdefault.pipe(
  Schema.decodeTo(Schema.Array(Network))
);

export const EnabledNetworksResponse = EnabledNetworkArray.pipe(
  Schema.decodeTo(
    Schema.ReadonlySet(Network),
    SchemaTransformation.transform({
      decode: (networks): ReadonlySet<Network> => new Set(networks),
      encode: (networks: ReadonlySet<Network>): ReadonlyArray<Network> =>
        Array.from(networks),
    })
  )
);
export type EnabledNetworks = typeof EnabledNetworksResponse.Type;

const SafeQueryParam = Schema.String.check(
  Schema.isPattern(/^(?!.*\.\.)[a-zA-Z0-9-_.+]*$/)
);

const PendingActionType = SafeQueryParam.check(Schema.isPattern(/^[A-Z_]+$/));

const InitTab = Schema.Literals(["earn", "positions"]);

const SafeYieldId = SafeQueryParam.check(
  Schema.isPattern(/^[^-]+-[^-]+-.+$/)
).pipe(Schema.decodeTo(YieldId));

const SupportedWalletNetwork = Network.pipe(
  Schema.decodeTo(
    Schema.declare<SupportedSKChains>(
      (value): value is SupportedSKChains =>
        typeof value === "string" && isSupportedChain(value),
      {
        expected: "a widget-supported network",
      }
    )
  )
);

export const WalletInitQueryParams = Schema.Struct({
  accountId: Schema.NullOr(Schema.String),
  balanceId: Schema.NullOr(SafeQueryParam),
  network: Schema.NullOr(SupportedWalletNetwork),
  pendingaction: Schema.NullOr(PendingActionType),
  tab: Schema.NullOr(InitTab),
  token: Schema.NullOr(Schema.String),
  validator: Schema.NullOr(Schema.String),
  yieldId: Schema.NullOr(SafeYieldId),
});
export type WalletInitQueryParams = typeof WalletInitQueryParams.Type;

export const WalletInitParams = Schema.Struct({
  ...WalletInitQueryParams.fields,
  yieldData: Schema.NullOr(EarnYield),
});
export type WalletInitParams = typeof WalletInitParams.Type;
