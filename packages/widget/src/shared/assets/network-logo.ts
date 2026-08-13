import type { Network } from "../../domain/network/network";
import { config } from "../config/widget-defaults";

export const networkLogoUrl = (network: Network) =>
  `${config.assetsUrl}/networks/${network}.svg`;
