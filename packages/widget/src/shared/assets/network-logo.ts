import type { Token } from "../../domain/token/token";
import { config } from "../config/widget-defaults";

export const networkLogoUrl = (network: Token["network"]) =>
  `${config.assetsUrl}/networks/${network}.svg`;
