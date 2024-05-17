import { useMemo } from "react";
import { useYieldMetaInfo } from "../../../hooks/use-yield-meta-info";
import {
  ArrowsLeftRightIcon,
  Box,
  ClockClockWiseIcon,
  GifIcon,
  Text,
} from "../../../components";
import { InfoIcon } from "../../../components/atoms/icons/info";
import { ContentLoaderSquare } from "../../../components/atoms/content-loader";
import { dotContainer } from "./styles.css";
import type { Maybe } from "purify-ts";
import type { TokenDto, ValidatorDto, YieldDto } from "@stakekit/api-hooks";

type Props = {
  isLoading?: boolean;
  selectedStake: Maybe<YieldDto>;
  selectedValidators: Map<string, ValidatorDto>;
  selectedToken: Maybe<TokenDto>;
};

export const MetaInfo = ({
  isLoading,
  selectedStake,
  selectedToken,
  selectedValidators,
}: Props) => {
  const {
    description,
    earnPeriod,
    earnRewards,
    withdrawnNotAvailable,
    withdrawnTime,
    extra,
  } = useYieldMetaInfo({
    selectedStake,
    validators: [...selectedValidators.values()],
    tokenDto: selectedToken,
  });

  const items = useMemo(
    () =>
      [
        { text: description, icon: <ArrowsLeftRightIcon /> },
        { text: earnPeriod, icon: <ClockClockWiseIcon /> },
        { text: earnRewards, icon: <GifIcon /> },
        { text: withdrawnNotAvailable, icon: <InfoIcon /> },
        { text: withdrawnTime, icon: <InfoIcon /> },
        { text: extra, icon: <InfoIcon /> },
      ].filter((val): val is { text: string; icon: JSX.Element } => !!val.text),
    [
      description,
      earnPeriod,
      earnRewards,
      withdrawnNotAvailable,
      withdrawnTime,
      extra,
    ]
  );

  return isLoading ? (
    <ContentLoaderSquare heightPx={150} />
  ) : (
    <Box as="footer" gap="3" display="flex" flexDirection="column">
      {items.map((item) => (
        <Box key={item.text} display="flex" alignItems="center" gap="4">
          <Box alignItems="center" justifyContent="center" display="flex">
            {item.icon ? (
              item.icon
            ) : (
              <Box className={dotContainer}>
                <Text
                  style={{ fontSize: "7px" }}
                  variant={{ weight: "normal", type: "muted" }}
                >
                  {"\u2B24"}
                </Text>
              </Box>
            )}
          </Box>

          <Box>
            <Text variant={{ weight: "normal", type: "muted" }}>
              {item.text}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
