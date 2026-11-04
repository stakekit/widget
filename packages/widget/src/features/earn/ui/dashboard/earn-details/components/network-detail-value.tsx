import type { Network } from "../../../../../../domain/network/network";
import { formatNetworkName } from "../../../../../../shared/lib/formatters";
import { useNetworkLogo } from "../../../../../../shared/react/token-logo";
import { Avatar, Stack, Text } from "../../../../../../ui/index";

export const NetworkDetailValue = ({ network }: { network: Network }) => {
  const networkLogoUri = useNetworkLogo(network);
  const networkName = formatNetworkName(network);

  return (
    <Stack as="span" direction="row" align="center" gap={6}>
      <Avatar src={networkLogoUri} fallback={networkName.charAt(0)} size="xs" />
      <Text truncate>{networkName}</Text>
    </Stack>
  );
};
