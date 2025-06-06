import { Box } from "@sk-widget/components/atoms/box";
import { Image } from "@sk-widget/components/atoms/image";
import type { Atoms } from "@sk-widget/styles/theme/atoms.css";
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
