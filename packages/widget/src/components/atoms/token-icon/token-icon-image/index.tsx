import type { Atoms } from "../../../../styles/theme/atoms.css";
import { Image } from "../../image";
import { ImageFallback } from "../../image-fallback";

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
    containerProps={{ hw: tokenLogoHw, "data-rk": "token-logo" }}
    src={mainUrl}
    fallback={
      <Image
        data-rk="token-logo"
        containerProps={{ hw: tokenLogoHw, "data-rk": "token-logo" }}
        src={fallbackUrl}
        fallback={<ImageFallback name={name} tokenLogoHw={tokenLogoHw} />}
      />
    }
  />
);
