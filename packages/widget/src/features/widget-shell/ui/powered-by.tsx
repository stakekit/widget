import { motion } from "motion/react";
import { Trans, useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import { Box } from "../../../shared/ui/primitives/box";
import { SKLogo } from "../../../shared/ui/primitives/icons/sk-logo";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { useMountAnimation } from "../../mount-animation/index";
import { useElementAtomRef } from "../react/use-element-atom-ref";
import { poweredByElementAtom } from "../state/layout-height";

export const PoweredBy = ({ opacity }: { opacity?: number }) => {
  const poweredByRef = useElementAtomRef(poweredByElementAtom);

  const { t } = useTranslation();

  const { state } = useMountAnimation();
  const dashboardVariant = useWidgetConfig("dashboardVariant");

  return (
    <motion.div
      data-rk="powered-by"
      ref={poweredByRef}
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
