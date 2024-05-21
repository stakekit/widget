import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import type { Networks } from "@stakekit/common";
import { useSettings } from "../../../providers/settings";
import type { Atoms } from "../../../styles";
import { getNetworkLogo } from "../../../utils";
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
}: {
  token: TokenDto;
  metadata?: YieldMetadataDto;
  tokenLogoHw?: Atoms["hw"];
  tokenNetworkLogoHw?: Atoms["hw"];
  hideNetwork?: boolean;
}) => {
  const { hideNetworkLogo } = useSettings();

  return (
    <Box
      position="relative"
      marginRight={hideNetwork ? "0" : "2"}
      display="flex"
    >
      <Image
        data-rk="token-logo"
        containerProps={{ hw: tokenLogoHw, "data-rk": "token-logo" }}
        src={metadata?.logoURI ?? token.logoURI}
        fallback={
          <ImageFallback
            name={metadata?.name ?? token.name}
            tokenLogoHw={tokenLogoHw}
          />
        }
      />
      {!hideNetwork && !hideNetworkLogo && (
        <Box className={logoContainer} data-rk="token-network-logo">
          <Image
            src={getNetworkLogo(token.network as Networks)}
            fallback={null}
            containerProps={{ hw: tokenNetworkLogoHw }}
            imageProps={{ className: logoImage }}
          />
        </Box>
      )}
    </Box>
  );
};
