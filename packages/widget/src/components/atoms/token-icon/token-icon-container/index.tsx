import { Box } from "@sk-widget/components/atoms/box";
import { useVariantNetworkUrls } from "@sk-widget/components/atoms/token-icon/token-icon-container/hooks/use-variant-network-urls";
import { useVariantTokenUrls } from "@sk-widget/components/atoms/token-icon/token-icon-container/hooks/use-variant-token-urls";
import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import type { Networks } from "@stakekit/common";
import type { ReactElement } from "react";

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
