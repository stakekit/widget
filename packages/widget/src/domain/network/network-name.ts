import type { Networks as LegacyNetworks } from "../../generated/api/legacy-networks.js";
import type { Networks as YieldNetworks } from "../../generated/api/yield-networks.js";

/**
 * Networks both backends declare. Types-only, so the published declarations
 * that reference it stay free of `effect`.
 */
export type Network = Extract<LegacyNetworks, YieldNetworks>;
