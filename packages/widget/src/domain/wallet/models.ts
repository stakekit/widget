import { Schema, SchemaTransformation } from "effect";
import {
  isWalletNetwork,
  WalletNetwork,
  type WalletNetwork as WalletNetworkType,
} from "./network";

// Network IDs stay open strings: the API adds networks independently of the
// generated client, and only Wallet Networks matter to the widget.
const EnabledNetworkIds = Schema.Array(Schema.Struct({ id: Schema.String }));

export const EnabledWalletNetworksResponse = EnabledNetworkIds.pipe(
  Schema.decodeTo(
    Schema.ReadonlySet(WalletNetwork),
    SchemaTransformation.transform({
      decode: (
        networks: ReadonlyArray<{ readonly id: string }>
      ): ReadonlySet<WalletNetworkType> =>
        new Set(networks.map(({ id }) => id).filter(isWalletNetwork)),
      encode: (
        networks: ReadonlySet<WalletNetworkType>
      ): ReadonlyArray<{ readonly id: string }> =>
        Array.from(networks, (id) => ({ id })),
    })
  )
);
export type EnabledWalletNetworks = typeof EnabledWalletNetworksResponse.Type;
