import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import type { Networks } from "@stakekit/common";
import type { ReactElement } from "react";
import { Box } from "../../box";
import { useVariantNetworkUrls } from "./hooks/use-variant-network-urls";
import { useVariantTokenUrls } from "./hooks/use-variant-token-urls";

type TokenIconContainerProps = {
  token: TokenDto;
  metadata?: YieldMetadataDto;
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

  const networkLogoUri = useVariantNetworkUrls(token.network as Networks);

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
