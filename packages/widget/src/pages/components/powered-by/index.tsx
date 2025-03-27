import { motion } from "motion/react";
import { Trans, useTranslation } from "react-i18next";
import { Box, Text } from "../../../components";
import { SKLogo } from "../../../components/atoms/icons/sk-logo";
import { useSyncElementHeight } from "../../../hooks/use-sync-element-height";
import { useMountAnimation } from "../../../providers/mount-animation";
import createStateContext from "../../../utils/create-state-context";

export const [usePoweredByHeight, PoweredByHeightProvider] =
  createStateContext(0);

const useSyncPoweredByHeight = () =>
  useSyncElementHeight(usePoweredByHeight()[1]);

export const PoweredBy = ({ opacity }: { opacity?: number }) => {
  const { containerRef } = useSyncPoweredByHeight();

  const { t } = useTranslation();

  const { state } = useMountAnimation();

  return (
    <motion.div
      data-rk="powered-by"
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{
        opacity: opacity || state.layout ? 1 : 0,
        transition: { duration: 0.3, delay: 0.2 },
      }}
    >
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        marginBottom="3"
        gap="1"
      >
        <Text variant={{ type: "muted", weight: "normal" }}>
          <Trans
            i18nKey="shared.powered_by"
            values={{ name: t("shared.stake_kit") }}
            components={{
              span0: (
                <Text
                  as="span"
                  variant={{ type: "muted", weight: "semibold" }}
                />
              ),
            }}
          />
        </Text>

        <SKLogo />
      </Box>
    </motion.div>
  );
};
