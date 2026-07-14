import type { ReactElement } from "react";
import type { AppToken } from "../../../../domain/schema/legacy-models";
import type { Network } from "../../../../domain/schema/network-model";

import type { YieldMetadata } from "../../../../domain/types/yields";
import { Box } from "../../box";
import { useVariantNetworkUrls } from "./hooks/use-variant-network-urls";
import { useVariantTokenUrls } from "./hooks/use-variant-token-urls";

type TokenIconContainerProps = {
  token: AppToken;
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
