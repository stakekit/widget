import { Schema, SchemaTransformation } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import {
  isWalletNetwork,
  WalletNetwork,
  type WalletNetwork as WalletNetworkType,
} from "./network";

const EnabledWalletNetworkIds = Schema.Array(
  Schema.Struct({ id: YieldApi.Networks })
);

export const EnabledWalletNetworksResponse = EnabledWalletNetworkIds.pipe(
  Schema.decodeTo(
    Schema.ReadonlySet(WalletNetwork),
    SchemaTransformation.transform({
      decode: (
        networks: ReadonlyArray<{ readonly id: YieldApi.Networks }>
      ): ReadonlySet<WalletNetworkType> =>
        new Set(networks.map(({ id }) => id).filter(isWalletNetwork)),
      encode: (
        networks: ReadonlySet<WalletNetworkType>
      ): ReadonlyArray<{ readonly id: YieldApi.Networks }> =>
        Array.from(networks, (id) => ({ id })),
    })
  )
);
export type EnabledWalletNetworks = typeof EnabledWalletNetworksResponse.Type;
