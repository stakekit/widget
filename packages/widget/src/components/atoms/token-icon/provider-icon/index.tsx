import { NetworkLogoImage } from "@sk-widget/components/atoms/token-icon/network-icon-image";
import { TokenIconContainer } from "@sk-widget/components/atoms/token-icon/token-icon-container";
import { TokenIconImage } from "@sk-widget/components/atoms/token-icon/token-icon-image";
import { useSettings } from "@sk-widget/providers/settings";
import type { Atoms } from "@sk-widget/styles/theme/atoms.css";
import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";

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
