import type { YieldMetadata } from "../../../../domain/earn/yield";
import type { Token } from "../../../../domain/token/token";
import type { Atoms } from "../../../styles/theme/atoms.css";

export type TokenIconProps = {
  token: Token;
  metadata?: Pick<YieldMetadata, "logoURI" | "name" | "provider">;
  tokenLogoHw?: Atoms["hw"];
  tokenNetworkLogoHw?: Atoms["hw"];
  hideNetwork?: boolean;
};
