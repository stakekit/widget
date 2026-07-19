import { useWidgetConfig } from "../../../../app/config/use-widget-config";
import type { AppToken } from "../../../../domain/schema/legacy-models";
import type { YieldMetadata } from "../../../../domain/types/yields";
import type { Atoms } from "../../../../shared/styles/theme/atoms.css";
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
  token: AppToken;
  metadata?: Pick<YieldMetadata, "logoURI" | "name" | "provider">;
  tokenLogoHw?: Atoms["hw"];
  tokenNetworkLogoHw?: Atoms["hw"];
  hideNetwork?: boolean;
}) => {
  const hideNetworkLogo = useWidgetConfig("hideNetworkLogo");

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
