import type { Atoms } from "../../../../styles/theme/atoms.css";
import { Box } from "../../box";
import { Image } from "../../image";
import { logoContainer, logoImage } from "./style.css";

type NetworkLogoImageProps = {
  networkLogoUri: string;
  tokenNetworkLogoHw?: Atoms["hw"];
};

export const NetworkLogoImage = ({
  networkLogoUri,
  tokenNetworkLogoHw = "3",
}: NetworkLogoImageProps) => (
  <Box className={logoContainer} data-rk="token-network-logo">
    <Image
      src={networkLogoUri}
      fallback={null}
      containerProps={{ hw: tokenNetworkLogoHw }}
      imageProps={{ className: logoImage }}
    />
  </Box>
);
