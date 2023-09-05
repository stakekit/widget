import { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import { Box } from "../box";
import { Image } from "../image";
import { logoContainer, smallLogo } from "./style.css";
import { Atoms } from "../../../styles";
import { ImageFallback } from "../image-fallback";
import { getNetworkLogo } from "../../../utils";
import { Networks } from "@stakekit/common";

export const TokenIcon = ({
  token,
  metadata,
  tokenLogoHw,
  tokenNetworkLogoHw,
}: {
  token: TokenDto;
  metadata: YieldMetadataDto;
  tokenLogoHw?: Atoms["hw"];
  tokenNetworkLogoHw?: Atoms["hw"];
}) => {
  return (
    <Box position="relative" marginRight="2" display="flex">
      <Image
        hw={tokenLogoHw ?? "9"}
        src={metadata.logoURI ?? token.logoURI}
        fallback={
          <ImageFallback
            name={metadata.name ?? token.name}
            tokenLogoHw={tokenLogoHw ?? "9"}
          />
        }
      />
      <Box className={logoContainer}>
        <Image
          className={smallLogo}
          src={getNetworkLogo(token.network as Networks)}
          fallback={<></>}
          hw={tokenNetworkLogoHw}
        />
      </Box>
    </Box>
  );
};
