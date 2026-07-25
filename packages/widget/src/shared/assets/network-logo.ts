import type { Network } from "../../domain/schema/network-model";
import { config } from "../config/widget-defaults";

export const networkLogoUrl = (network: Network) =>
  `${config.assetsUrl}/networks/${network}.svg`;
