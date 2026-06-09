import { useState } from "react";
import type { Atoms } from "../../../../styles/theme/atoms.css";
import { Box } from "../../box";
import { Image } from "../../image";
import { fallbackContainer, logoContainer, logoImage } from "./style.css";

type NetworkLogoImageProps = {
  networkLogoUri: string;
  networkName?: string;
  tokenNetworkLogoHw?: Atoms["hw"];
};

export const NetworkLogoImage = ({
  networkLogoUri,
  networkName,
  tokenNetworkLogoHw = "3",
}: NetworkLogoImageProps) => {
  const [erroredUri, setErroredUri] = useState<string | null>(null);

  const hasError = erroredUri === networkLogoUri;

  if (!networkLogoUri || hasError) {
    const initial = networkName?.trim()?.[0]?.toUpperCase() ?? "?";

    return (
      <Box className={fallbackContainer} data-rk="token-network-logo-fallback">
        <Box hw={tokenNetworkLogoHw} display="flex">
          <ChainInitial initial={initial} />
        </Box>
      </Box>
    );
  }

  return (
    <Box className={logoContainer} data-rk="token-network-logo">
      <Image
        src={networkLogoUri}
        wrapperProps={{ hw: tokenNetworkLogoHw }}
        imgProps={{
          hw: tokenNetworkLogoHw,
          className: logoImage,
          onError: () => setErroredUri(networkLogoUri),
        }}
      />
    </Box>
  );
};

const ChainInitial = ({ initial }: { initial: string }) => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <text
      x="50"
      y="52"
      fill="#fff"
      fontFamily="Arial, sans-serif"
      fontSize="64"
      fontWeight="700"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {initial}
    </text>
  </svg>
);
