import { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import { Box } from "../box";
import { Image } from "../image";
import { logoContainer, logoImage } from "./style.css";
import { Atoms } from "../../../styles";
import { ImageFallback } from "../image-fallback";
import { getNetworkLogo } from "../../../utils";
import { Networks } from "@stakekit/common";

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
  return (
    <Box
      position="relative"
      marginRight={hideNetwork ? "0" : "2"}
      display="flex"
    >
      <Image
        containerProps={{ hw: tokenLogoHw }}
        src={metadata?.logoURI ?? token.logoURI}
        fallback={
          <ImageFallback
            name={metadata?.name ?? token.name}
            tokenLogoHw={tokenLogoHw}
          />
        }
      />
      {!hideNetwork && (
        <Box className={logoContainer}>
          <Image
            src={getNetworkLogo(token.network as Networks)}
            fallback={<></>}
            containerProps={{ hw: tokenNetworkLogoHw }}
            imageProps={{ className: logoImage }}
          />
        </Box>
      )}
    </Box>
  );
};
