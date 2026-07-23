import type { Network } from "../../../../../../domain/schema/network-model";
import { formatNetworkName } from "../../../../../../shared/lib/formatters";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { Image } from "../../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import { useVariantNetworkUrls } from "../../../../../widget-shell/ui/token-icon/token-icon-container/hooks/use-variant-network-urls";

import * as styles from "../styles.css";

export const NetworkDetailValue = ({ network }: { network: string }) => {
  const networkLogoUri = useVariantNetworkUrls(network as Network);
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
