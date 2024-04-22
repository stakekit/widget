import {
  ArrowsLeftRightIcon,
  Box,
  ClockClockWiseIcon,
  GifIcon,
  Text,
} from "../../../../components";
import { useMemo } from "react";
import { dotContainer } from "../styles.css";
import { useDetailsContext } from "../state/details-context";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { InfoIcon } from "../../../../components/atoms/icons/info";
import { useYieldMetaInfo } from "../../../../hooks/use-yield-meta-info";

export const Footer = () => {
  const {
    appLoading,
    multiYieldsLoading,
    yieldOpportunityLoading,
    tokenBalancesScanLoading,
    stakeTokenAvailableAmountLoading,
    defaultTokensIsLoading,
    selectedStake,
    selectedValidators,
    selectedTokenBalance,
  } = useDetailsContext();

  const {
    description,
    earnPeriod,
    earnRewards,
    minimumStakeAmount,
    withdrawnNotAvailable,
    withdrawnTime,
    compoundRewards,
    extra,
  } = useYieldMetaInfo({
    selectedStake,
    validators: [...selectedValidators.values()],
    tokenDto: selectedTokenBalance.map((v) => v.token),
  });

  const isLoading =
    appLoading ||
    defaultTokensIsLoading ||
    tokenBalancesScanLoading ||
    multiYieldsLoading ||
    yieldOpportunityLoading ||
    stakeTokenAvailableAmountLoading;

  const items = useMemo(
    () =>
      [
        { text: description, icon: <ArrowsLeftRightIcon /> },
        { text: earnPeriod, icon: <ClockClockWiseIcon /> },
        { text: earnRewards, icon: <GifIcon /> },
        { text: minimumStakeAmount, icon: <InfoIcon /> },
        { text: withdrawnNotAvailable, icon: <InfoIcon /> },
        { text: withdrawnTime, icon: <InfoIcon /> },
        { text: compoundRewards, icon: <InfoIcon /> },
        { text: extra, icon: <InfoIcon /> },
      ].filter((val): val is { text: string; icon: JSX.Element } => !!val.text),
    [
      description,
      earnPeriod,
      earnRewards,
      minimumStakeAmount,
      withdrawnNotAvailable,
      withdrawnTime,
      compoundRewards,
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
            <Text
              variant={{
                weight: "normal",
                type: "muted",
              }}
            >
              {item.text}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
