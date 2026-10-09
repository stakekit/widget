import { NetworkLogoImage } from "../network-icon-image";
import type { TokenIconProps } from "../props";
import { TokenIconContainer } from "../token-icon-container";
import { TokenIconImage } from "../token-icon-image";

export const ProviderIcon = ({
  token,
  metadata,
  tokenLogoHw,
  tokenNetworkLogoHw,
  hideNetwork,
}: TokenIconProps) => {
  return (
    <TokenIconContainer
      hideNetwork={hideNetwork}
      token={token}
      metadata={metadata}
    >
      {({ fallbackUrl, mainUrl, name, providerIcon }) => (
        <>
          <TokenIconImage
            fallbackUrl={fallbackUrl}
            mainUrl={mainUrl}
            name={name}
            tokenLogoHw={tokenLogoHw}
          />
          {!hideNetwork && providerIcon && (
            <NetworkLogoImage
              networkLogoUri={providerIcon}
              networkName={token.network}
              tokenNetworkLogoHw={tokenNetworkLogoHw}
            />
          )}
        </>
      )}
    </TokenIconContainer>
  );
};
