import { Box } from "../../../../components/atoms/box";
import { Image } from "../../../../components/atoms/image";
import { useVariantNetworkUrls } from "../../../../components/atoms/token-icon/token-icon-container/hooks/use-variant-network-urls";
import { Text } from "../../../../components/atoms/typography/text";
import type { Networks } from "../../../../domain/types/chains/networks";
import { formatNetworkName } from "../earn-details-formatters";
import * as styles from "../styles.css";

export const NetworkDetailValue = ({ network }: { network: string }) => {
  const networkLogoUri = useVariantNetworkUrls(network as Networks);
  const networkName = formatNetworkName(network);

  return (
    <Box className={styles.networkValue}>
      <Image
        wrapperProps={{ hw: "4", flexShrink: 0 }}
        imgProps={{ borderRadius: "half" }}
        src={networkLogoUri}
        fallbackName={networkName}
      />
      <Text className={styles.valueText} variant={{ weight: "normal" }}>
        {networkName}
      </Text>
    </Box>
  );
};
