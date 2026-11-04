import type { Atoms } from "../../../../styles/theme/atoms.css";
import { Image } from "../../../primitives/image";

type TokenIconProps = {
  mainUrl?: string | undefined;
  fallbackUrl?: string | undefined;
  name: string;
  tokenLogoHw?: Atoms["hw"] | undefined;
};

export const TokenIconImage = ({
  mainUrl,
  fallbackUrl,
  name,
  tokenLogoHw = "9",
}: TokenIconProps) => (
  <Image
    data-rk="token-logo"
    wrapperProps={{ hw: tokenLogoHw, "data-rk": "token-logo" }}
    imgProps={{ hw: "full" }}
    src={mainUrl ?? fallbackUrl}
    fallbackName={name}
  />
);
