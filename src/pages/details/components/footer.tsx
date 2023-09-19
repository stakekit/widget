import {
  ArrowsLeftRightIcon,
  Box,
  ClockClockWiseIcon,
  GifIcon,
  Text,
} from "../../../components";
import { useFooterItems } from "../hooks/use-footer-items";
import { useMemo } from "react";

export const Footer = ({
  description,
  earnPeriod,
  earnRewards,
  minimumStakeAmount,
  withdrawnNotAvailable,
  withdrawnTime,
  compoundRewards,
}: ReturnType<typeof useFooterItems>) => {
  const items = useMemo(
    () =>
      [
        { text: description, icon: <ArrowsLeftRightIcon /> },
        { text: earnPeriod, icon: <ClockClockWiseIcon /> },
        { text: earnRewards, icon: <GifIcon /> },
        { text: minimumStakeAmount, icon: null },
        { text: withdrawnNotAvailable, icon: null },
        { text: withdrawnTime, icon: null },
        { text: compoundRewards, icon: null },
      ].filter(
        (val): val is { text: string; icon: JSX.Element | null } => !!val.text
      ),
    [
      description,
      earnPeriod,
      earnRewards,
      minimumStakeAmount,
      withdrawnNotAvailable,
      withdrawnTime,
      compoundRewards,
    ]
  );

  return (
    <Box gap="3" display="flex" flexDirection="column">
      {items.map((item) => (
        <Box key={item.text} display="flex" alignItems="center">
          <Box
            hw="4"
            marginRight="2"
            alignItems="center"
            justifyContent="center"
            display="flex"
          >
            {item.icon ? (
              item.icon
            ) : (
              <Text
                style={{ fontSize: "7px" }}
                variant={{ weight: "normal", type: "muted" }}
              >
                {"\u2B24"}
              </Text>
            )}
          </Box>
          <Text
            variant={{
              weight: "normal",
              type: "muted",
              size: "small",
            }}
          >
            {item.text}
          </Text>
        </Box>
      ))}
    </Box>
  );
};
