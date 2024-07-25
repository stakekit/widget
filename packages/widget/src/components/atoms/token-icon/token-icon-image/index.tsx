import { Image } from "@sk-widget/components/atoms/image";
import { ImageFallback } from "@sk-widget/components/atoms/image-fallback";
import type { Atoms } from "@sk-widget/styles";

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
