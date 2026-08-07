import { Schema, SchemaTransformation } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
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
