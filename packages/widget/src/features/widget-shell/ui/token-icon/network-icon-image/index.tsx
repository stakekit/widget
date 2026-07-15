import type { Atoms } from "../../../../../shared/styles/theme/atoms.css";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Image } from "../../../../../shared/ui/primitives/image";
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
