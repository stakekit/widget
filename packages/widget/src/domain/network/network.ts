import { Schema } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
import * as YieldApi from "../../generated/api/yield-schema";
import { intersectNetworkLiterals } from "./intersection";
import type { Network as NetworkName } from "./network-name";

export const Network = Schema.Literals(
  intersectNetworkLiterals(
    LegacyApi.Networks.literals,
    YieldApi.Networks.literals
  )
).annotate({ identifier: "Networks" });
export type Network = NetworkName;
