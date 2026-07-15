import type { Network } from "../../../../../../domain/schema/network-model";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { Image } from "../../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import { useVariantNetworkUrls } from "../../../../../widget-shell";

import { formatNetworkName } from "../earn-details-formatters";
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
