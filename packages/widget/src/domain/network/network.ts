import { Schema } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
import * as YieldApi from "../../generated/api/yield-schema";
import { intersectNetworkLiterals } from "./intersection";

export const Network = Schema.Literals(
  intersectNetworkLiterals(
    LegacyApi.Networks.literals,
    YieldApi.Networks.literals
  )
).annotate({ identifier: "Networks" });
export type Network = typeof Network.Type;

const EvmNetwork = Schema.Literals(
  intersectNetworkLiterals(Network.literals, LegacyApi.EvmNetworks.literals)
);

export const isEvmNetwork = Schema.is(EvmNetwork);
