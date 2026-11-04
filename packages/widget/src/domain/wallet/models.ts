import { Schema, SchemaTransformation } from "effect";
import {
  isWalletNetwork,
  WalletNetwork,
  type WalletNetwork as WalletNetworkType,
} from "./network";

// Network IDs stay open: the API adds networks independently of the generated
// client, and only Wallet Networks matter to the widget. The brand keeps an
// unvetted API network ID apart from a Wallet Network.
const ApiNetworkId = Schema.String.pipe(Schema.brand("ApiNetworkId"));
type ApiNetworkId = typeof ApiNetworkId.Type;

const EnabledNetworkIds = Schema.Array(Schema.Struct({ id: ApiNetworkId }));

export const EnabledWalletNetworksResponse = EnabledNetworkIds.pipe(
  Schema.decodeTo(
    Schema.ReadonlySet(WalletNetwork),
    SchemaTransformation.transform({
      decode: (
        networks: ReadonlyArray<{ readonly id: ApiNetworkId }>
      ): ReadonlySet<WalletNetworkType> =>
        new Set(networks.map(({ id }) => id).filter(isWalletNetwork)),
      encode: (
        networks: ReadonlySet<WalletNetworkType>
      ): ReadonlyArray<{ readonly id: ApiNetworkId }> =>
        Array.from(networks, (id) => ({ id: ApiNetworkId.make(id) })),
    })
  )
);
export type EnabledWalletNetworks = typeof EnabledWalletNetworksResponse.Type;
