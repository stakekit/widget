import { useWidgetPresentation } from "../../widget-presentation";
import { NetworkLogoImage } from "./network-icon-image";
import type { TokenIconProps } from "./props";
import { TokenIconContainer } from "./token-icon-container";
import { TokenIconImage } from "./token-icon-image";

export const TokenIcon = ({
  token,
  metadata,
  tokenLogoHw,
  tokenNetworkLogoHw,
  hideNetwork,
}: TokenIconProps) => {
  const { hideNetworkLogo } = useWidgetPresentation();

  return (
    <TokenIconContainer
      hideNetwork={hideNetwork}
      token={token}
      metadata={metadata}
    >
      {({ fallbackUrl, mainUrl, name, networkLogoUri }) => (
        <>
          <TokenIconImage
            fallbackUrl={fallbackUrl}
            mainUrl={mainUrl}
            name={name}
            tokenLogoHw={tokenLogoHw}
          />
          {!hideNetwork && !hideNetworkLogo && (
            <NetworkLogoImage
              networkLogoUri={networkLogoUri}
              networkName={token.network}
              tokenNetworkLogoHw={tokenNetworkLogoHw}
            />
          )}
        </>
      )}
    </TokenIconContainer>
  );
};
