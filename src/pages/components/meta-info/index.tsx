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
import { useStakeState } from "../../../state/stake";

type Props = {
  isLoading?: boolean;
};

export const MetaInfo = ({ isLoading }: Props) => {
  const { selectedStake, selectedValidators, selectedTokenBalance } =
    useStakeState();

  const {
    description,
    earnPeriod,
    earnRewards,
    minimumStakeAmount,
    withdrawnNotAvailable,
    withdrawnTime,
    extra,
  } = useYieldMetaInfo({
    selectedStake,
    validators: [...selectedValidators.values()],
    tokenDto: selectedTokenBalance.map((v) => v.token),
  });

  const items = useMemo(
    () =>
      [
        { text: description, icon: <ArrowsLeftRightIcon /> },
        { text: earnPeriod, icon: <ClockClockWiseIcon /> },
        { text: earnRewards, icon: <GifIcon /> },
        { text: minimumStakeAmount, icon: <InfoIcon /> },
        { text: withdrawnNotAvailable, icon: <InfoIcon /> },
        { text: withdrawnTime, icon: <InfoIcon /> },
        { text: extra, icon: <InfoIcon /> },
      ].filter((val): val is { text: string; icon: JSX.Element } => !!val.text),
    [
      description,
      earnPeriod,
      earnRewards,
      minimumStakeAmount,
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
