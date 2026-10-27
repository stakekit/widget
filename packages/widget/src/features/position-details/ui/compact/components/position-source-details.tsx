import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "../../../../../shared/ui/components/collapsible";
import { Divider } from "../../../../../shared/ui/components/divider";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Image } from "../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../shared/ui/primitives/typography/text";

export const PositionSourceDetails = ({
  children,
  hasDetails,
  headerAccessory,
  isFirst,
  logo,
  name,
  stakeType,
}: {
  children?: ReactNode;
  hasDetails: boolean;
  headerAccessory?: ReactNode;
  isFirst: boolean;
  logo: string | undefined;
  name: string;
  stakeType: string;
}) => {
  const { t } = useTranslation();

  return (
    <CollapsibleRoot>
      <Box display="flex" flexDirection="column">
        {isFirst && <Divider />}

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          my="2"
        >
          <Box display="flex" justifyContent="flex-start" alignItems="center">
            <Box marginRight="2">
              <Image
                wrapperProps={{ hw: "8" }}
                imgProps={{ borderRadius: "full" }}
                src={logo}
                fallbackName={name}
              />
            </Box>

            <Text>
              {t("position_details.via", {
                providerName: name,
                stakeType,
              })}
            </Text>

            {headerAccessory}
          </Box>

          {hasDetails ? (
            <CollapsibleTrigger
              data-testid="position-source-details-trigger"
              flex={1}
              justifyContent="flex-end"
            >
              <CollapsibleArrow />
            </CollapsibleTrigger>
          ) : null}
        </Box>

        {hasDetails ? (
          <CollapsibleContent>{children}</CollapsibleContent>
        ) : null}

        <Divider />
      </Box>
    </CollapsibleRoot>
  );
};
