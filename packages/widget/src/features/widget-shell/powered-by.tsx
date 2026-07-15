import { useAtom } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { motion } from "motion/react";
import { Trans, useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../app/config";
import { useMountAnimation } from "../../features/mount-animation";
import { useSyncElementHeight } from "../../shared/react/use-sync-element-height";
import { Box } from "../../shared/ui/primitives/box";
import { SKLogo } from "../../shared/ui/primitives/icons/sk-logo";
import { Text } from "../../shared/ui/primitives/typography/text";

const poweredByHeightAtom = Atom.make(0);

export const usePoweredByHeight = () => useAtom(poweredByHeightAtom);

const useSyncPoweredByHeight = () =>
  useSyncElementHeight(usePoweredByHeight()[1]);

export const PoweredBy = ({ opacity }: { opacity?: number }) => {
  const { containerRef } = useSyncPoweredByHeight();

  const { t } = useTranslation();

  const { state } = useMountAnimation();
  const dashboardVariant = useWidgetConfig("dashboardVariant");

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
        paddingTop={dashboardVariant ? undefined : "3"}
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
