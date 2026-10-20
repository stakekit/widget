import type { ReactNode } from "react";
import type { Token } from "../../../../domain/token/token";
import { TokenIcon } from "../../../../shared/ui/components/token-icon";
import { Box } from "../../../../shared/ui/primitives/box";
import { Text } from "../../../../shared/ui/primitives/typography/text";

/** One token row in a select modal: icon, symbol, detail, optional trailing. */
export const TokenOptionRow = ({
  detail,
  token,
  trailing,
}: {
  readonly detail: string;
  readonly token: Token;
  readonly trailing?: ReactNode;
}) => (
  <>
    <TokenIcon token={token} />
    <Box
      display="flex"
      flex={1}
      justifyContent="space-between"
      alignItems="center"
      marginLeft="2"
      minWidth="0"
      gap="2"
    >
      <Box display="flex" flexDirection="column" minWidth="0" gap="1">
        <Text variant={{ weight: "bold" }}>{token.symbol}</Text>
        <Text variant={{ type: "muted", weight: "normal", size: "small" }}>
          {detail}
        </Text>
      </Box>
      {trailing}
    </Box>
  </>
);
