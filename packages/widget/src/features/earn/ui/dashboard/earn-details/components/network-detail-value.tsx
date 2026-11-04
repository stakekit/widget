import type { Network } from "../../../../../../domain/network/network";
import { formatNetworkName } from "../../../../../../shared/lib/formatters";
import { useVariantNetworkUrls } from "../../../../../../shared/ui/components/token-icon/token-icon-container/hooks/use-variant-network-urls";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { Image } from "../../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";

import * as styles from "../styles.css";

export const NetworkDetailValue = ({ network }: { network: Network }) => {
  const networkLogoUri = useVariantNetworkUrls(network);
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
