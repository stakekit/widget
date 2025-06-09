import { Box } from "@sk-widget/components/atoms/box";
import { TokenIcon } from "@sk-widget/components/atoms/token-icon";
import { Heading } from "@sk-widget/components/atoms/typography/heading";
import { Text } from "@sk-widget/components/atoms/typography/text";
import type { RewardTokenDetails } from "@sk-widget/components/molecules/reward-token-details";
import { headingStyles } from "@sk-widget/pages/review/pages/style.css";
import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import { motion } from "motion/react";
import { Maybe } from "purify-ts";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  title: string;
  token: Maybe<TokenDto>;
  metadata: Maybe<YieldMetadataDto>;
  info: ReactNode;
  rewardTokenDetailsProps?: Maybe<ComponentProps<typeof RewardTokenDetails>>;
};

const ReviewTopSection = ({
  title,
  token,
  metadata,
  info,
  rewardTokenDetailsProps,
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
          {Maybe.fromRecord({ token, metadata })
            .map((val) => (
              <TokenIcon token={val.token} metadata={val.metadata} />
            ))
            .extractNullable()}
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

      {rewardTokenDetailsProps
        ?.filter((v) => v.type === "stake")
        .map(() => (
          <Box marginTop="2">
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("review.estimated_reward")}
            </Text>
          </Box>
        ))
        .extractNullable()}
    </Box>
  );
};

export default ReviewTopSection;
