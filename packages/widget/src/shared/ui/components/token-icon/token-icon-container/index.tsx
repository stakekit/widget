import type { ReactElement } from "react";
import type { YieldMetadata } from "../../../../../domain/earn/yield";
import type { Network } from "../../../../../domain/network/network";
import type { Token } from "../../../../../domain/token/token";
import { Box } from "../../../primitives/box";
import { useVariantNetworkUrls } from "./hooks/use-variant-network-urls";
import { useVariantTokenUrls } from "./hooks/use-variant-token-urls";

type TokenIconContainerProps = {
  token: Token;
  metadata?: Pick<YieldMetadata, "logoURI" | "name" | "provider">;
  hideNetwork?: boolean;
  children: (props: TokenIconContainerReturnType) => ReactElement;
};

type TokenIconContainerReturnType = ReturnType<typeof useVariantTokenUrls> & {
  networkLogoUri: string;
};

export const TokenIconContainer = ({
  token,
  metadata,
  hideNetwork,
  children,
}: TokenIconContainerProps) => {
  const { mainUrl, fallbackUrl, name, providerIcon } = useVariantTokenUrls(
    token,
    metadata
  );

  const networkLogoUri = useVariantNetworkUrls(token.network as Network);

  return (
    <Box
      position="relative"
      marginRight={hideNetwork ? "0" : "2"}
      display="flex"
    >
      {children({ mainUrl, fallbackUrl, name, networkLogoUri, providerIcon })}
    </Box>
  );
};
