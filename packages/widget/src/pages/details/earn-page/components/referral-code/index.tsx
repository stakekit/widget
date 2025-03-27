import { AnimatePresence, motion } from "motion/react";
import { Maybe } from "purify-ts";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../../../components";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { Check } from "../../../../../components/atoms/icons/check";
import { Copy } from "../../../../../components/atoms/icons/copy";
import { useOwnReferralCode } from "../../../../../hooks/api/referral/use-own-referral-code";
import { MaybeWindow } from "../../../../../utils/maybe-window";
import { useEarnPageContext } from "../../state/earn-page-context";

export const ReferralCode = () => {
  const { appLoading } = useEarnPageContext();

  const referralCode = useOwnReferralCode();
  const isLoading = appLoading || referralCode.isLoading;

  const url = useMemo(
    () =>
      MaybeWindow.chain((w) =>
        Maybe.fromNullable(referralCode.data).map((data) => ({ data, w }))
      )
        .map((val) => `${val.w.location.origin}/?ref=${val.data.code}`)
        .extractNullable(),
    [referralCode.data]
  );

  const { t } = useTranslation();

  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const onClick = (val: string) => {
    MaybeWindow.ifJust((w) => w.navigator.clipboard.writeText(val));
    setShowCopySuccess(true);
  };

  useEffect(() => {
    if (!showCopySuccess) return;

    const timeout = setTimeout(() => setShowCopySuccess(false), 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, [showCopySuccess]);

  return isLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={20} variant={{ size: "medium" }} />
    </Box>
  ) : (
    Maybe.fromNullable(url)
      .map((val) => (
        <Box
          px="3"
          py="3"
          background="backgroundMuted"
          borderRadius="md"
          display="flex"
          flexDirection="column"
        >
          <Box marginBottom="3">
            <Text variant={{ size: "medium" }}>
              {t("details.referral_code.title")}
            </Text>
          </Box>

          <Box
            background="background"
            px="3"
            py="3"
            borderRadius="md"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            as="button"
            onClick={() => onClick(val)}
          >
            <Text variant={{ size: "large" }}>{val}</Text>
            <AnimatePresence mode="wait">
              <motion.div
                key={showCopySuccess ? "copy" : "check"}
                whileTap={{ scale: showCopySuccess ? 1 : 0.9 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.05 } }}
                exit={{ opacity: 0, transition: { duration: 0.05 } }}
              >
                {showCopySuccess ? (
                  <Check color="positionsClaimRewardsBackground" />
                ) : (
                  <Copy />
                )}
              </motion.div>
            </AnimatePresence>
          </Box>
        </Box>
      ))
      .extractNullable()
  );
};
