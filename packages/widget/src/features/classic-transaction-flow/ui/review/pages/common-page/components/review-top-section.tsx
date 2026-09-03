import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Token } from "../../../../../../../domain/token/token";
import { TokenIcon } from "../../../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { Heading } from "../../../../../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import {
  EstimatedRewardAmounts,
  type RewardTokenDetails,
} from "../../../../../../yield-summary/views";
import { headingStyles } from "../../style.css";

type Props = {
  facts?: ReadonlyArray<Readonly<{ label: string; value: string }>>;
  title: string;
  token: Token | null;
  metadata: ComponentProps<typeof TokenIcon>["metadata"] | null;
  info: ReactNode;
  rewardTokenDetailsProps?: ComponentProps<typeof RewardTokenDetails> | null;
  estimatedRewardAmounts?: {
    earnYearly: string;
    earnMonthly: string;
  } | null;
};

const ReviewTopSection = ({
  facts,
  title,
  token,
  metadata,
  info,
  rewardTokenDetailsProps,
  estimatedRewardAmounts,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Box marginBottom="4">
      <motion.div
        initial={{ opacity: 0, translateY: "-20px" }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ duration: 1 }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          marginBottom="1"
        >
          <Heading variant={{ level: "h1" }}>{title}</Heading>
          {token && metadata ? (
            <TokenIcon token={token} metadata={metadata} />
          ) : null}
        </Box>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, translateY: "-20px" }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ duration: 1, delay: 0.3 }}
      >
        <Heading
          variant={{ level: "h2" }}
          overflowWrap="anywhere"
          className={headingStyles}
        >
          {info}
        </Heading>
      </motion.div>

      {facts?.length ? (
        <Box display="flex" flexDirection="column" gap="2" marginTop="4">
          {facts.map((fact) => (
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              gap="3"
              key={fact.label}
            >
              <Text variant={{ type: "muted", weight: "normal" }}>
                {fact.label}
              </Text>
              <Text variant={{ weight: "semibold" }}>{fact.value}</Text>
            </Box>
          ))}
        </Box>
      ) : null}

      {rewardTokenDetailsProps?.type === "stake" ? (
        <Box marginTop="4" display="flex" flexDirection="column" gap="1">
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("review.estimated_reward")}
          </Text>
          {estimatedRewardAmounts ? (
            <EstimatedRewardAmounts
              earnMonthly={estimatedRewardAmounts.earnMonthly}
              earnYearly={estimatedRewardAmounts.earnYearly}
            />
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
};

export default ReviewTopSection;
