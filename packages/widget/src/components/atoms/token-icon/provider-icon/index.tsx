import type { TokenDto } from "../../../../domain/types/tokens";
import type { YieldMetadata } from "../../../../domain/types/yields";
import type { Atoms } from "../../../../styles/theme/atoms.css";
import { NetworkLogoImage } from "../network-icon-image";
import { TokenIconContainer } from "../token-icon-container";
import { TokenIconImage } from "../token-icon-image";

export const ProviderIcon = ({
  token,
  metadata,
  tokenLogoHw,
  tokenNetworkLogoHw,
  hideNetwork,
}: {
  token: TokenDto;
  metadata?: Pick<YieldMetadata, "logoURI" | "name" | "provider">;
  tokenLogoHw?: Atoms["hw"];
  tokenNetworkLogoHw?: Atoms["hw"];
  hideNetwork?: boolean;
}) => {
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
              tokenNetworkLogoHw={tokenNetworkLogoHw}
            />
          )}
        </>
      )}
    </TokenIconContainer>
  );
};
