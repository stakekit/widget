import type { TokenDto, YieldTokenDto } from "../../../domain/types/tokens";
import type { YieldMetadata } from "../../../domain/types/yields";
import { useSettings } from "../../../providers/settings";
import type { Atoms } from "../../../styles/theme/atoms.css";
import { NetworkLogoImage } from "./network-icon-image";
import { TokenIconContainer } from "./token-icon-container";
import { TokenIconImage } from "./token-icon-image";

export const TokenIcon = ({
  token,
  metadata,
  tokenLogoHw,
  tokenNetworkLogoHw,
  hideNetwork,
}: {
  token: TokenDto | YieldTokenDto;
  metadata?: Pick<YieldMetadata, "logoURI" | "name" | "provider">;
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
              tokenNetworkLogoHw={tokenNetworkLogoHw}
            />
          )}
        </>
      )}
    </TokenIconContainer>
  );
};
