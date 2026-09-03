import type { YieldMetadata } from "../../../../domain/earn/yield";
import type { Token } from "../../../../domain/token/token";
import type { Atoms } from "../../../styles/theme/atoms.css";
import { useWidgetPresentation } from "../../widget-presentation";
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
  token: Token;
  metadata?: Pick<YieldMetadata, "logoURI" | "name" | "provider">;
  tokenLogoHw?: Atoms["hw"];
  tokenNetworkLogoHw?: Atoms["hw"];
  hideNetwork?: boolean;
}) => {
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
