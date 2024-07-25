import { NetworkLogoImage } from "@sk-widget/components/atoms/network-icon-image";
import { TokenIconContainer } from "@sk-widget/components/atoms/token-icon-container";
import { TokenIconImage } from "@sk-widget/components/atoms/token-icon-image";
import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import { useSettings } from "../../../providers/settings";
import type { Atoms } from "../../../styles";

export const ProviderIcon = ({
  token,
  metadata,
  tokenLogoHw,
  tokenNetworkLogoHw,
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
    <TokenIconContainer
      hideNetwork={hideNetwork}
      token={token}
      metadata={metadata}
    >
      {({ fallbackUrl, mainUrl, name, networkLogoUri, providerIcon }) => (
        <>
          <TokenIconImage
            fallbackUrl={fallbackUrl}
            mainUrl={providerIcon}
            name={name}
            tokenLogoHw={tokenLogoHw}
          />
          {!hideNetwork && !hideNetworkLogo && (
            <NetworkLogoImage
              networkLogoUri={mainUrl || networkLogoUri}
              tokenNetworkLogoHw={tokenNetworkLogoHw}
            />
          )}
        </>
      )}
    </TokenIconContainer>
  );
};
