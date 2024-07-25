import { useVariantTokenUrls } from "@sk-widget/hooks/use-variant-token-urls";
import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import { useSettings } from "../../../providers/settings";
import type { Atoms } from "../../../styles";
import { Box } from "../box";
import { Image } from "../image";
import { ImageFallback } from "../image-fallback";
import { logoContainer, logoImage } from "./style.css";

export const TokenIcon = ({
  token,
  metadata,
  tokenLogoHw = "9",
  tokenNetworkLogoHw = "3",
  hideNetwork,
  customLogo,
  customNetworkLogo,
}: {
  token: TokenDto;
  metadata?: YieldMetadataDto;
  tokenLogoHw?: Atoms["hw"];
  tokenNetworkLogoHw?: Atoms["hw"];
  hideNetwork?: boolean;
  customLogo?: string;
  customNetworkLogo?: string;
}) => {
  const { hideNetworkLogo } = useSettings();
  const { mainUrl, fallbackUrl, name, networkLogo } = useVariantTokenUrls(
    token,
    metadata,
    customLogo,
    customNetworkLogo
  );

  return (
    <Box
      position="relative"
      marginRight={hideNetwork ? "0" : "2"}
      display="flex"
    >
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
      {!hideNetwork && !hideNetworkLogo && (
        <Box className={logoContainer} data-rk="token-network-logo">
          <Image
            src={networkLogo}
            fallback={null}
            containerProps={{ hw: tokenNetworkLogoHw }}
            imageProps={{ className: logoImage }}
          />
        </Box>
      )}
    </Box>
  );
};
