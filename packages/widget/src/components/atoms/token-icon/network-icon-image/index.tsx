import type { Atoms } from "../../../../styles/theme/atoms.css";
import { Box } from "../../box";
import { Image } from "../../image";
import { logoContainer, logoImage } from "./style.css";

type NetworkLogoImageProps = {
  networkLogoUri: string;
  networkName?: string;
  tokenNetworkLogoHw?: Atoms["hw"];
};

export const NetworkLogoImage = ({
  networkLogoUri,
  networkName,
  tokenNetworkLogoHw = "3",
}: NetworkLogoImageProps) => (
  <Box className={logoContainer} data-rk="token-network-logo">
    <Image
      src={networkLogoUri}
      fallbackName={networkName}
      wrapperProps={{ hw: tokenNetworkLogoHw }}
      imgProps={{ hw: tokenNetworkLogoHw, className: logoImage }}
    />
  </Box>
);
