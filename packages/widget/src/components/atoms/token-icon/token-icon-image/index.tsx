import type { Atoms } from "../../../../styles/theme/atoms.css";
import { Image } from "../../image";

type TokenIconProps = {
  mainUrl?: string;
  fallbackUrl?: string;
  name: string;
  tokenLogoHw?: Atoms["hw"];
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
    imgProps={{ hw: tokenLogoHw }}
    src={mainUrl ?? fallbackUrl}
    fallbackName={name}
  />
);
