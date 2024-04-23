import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../../../components";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "../../../../../components/atoms/collapsible";
import { useSettings } from "../../../../../providers/settings";
import { MetaInfo } from "../../../../components/meta-info";
import { useDetailsContext } from "../../state/details-context";

export const Footer = () => {
  const { t } = useTranslation();

  const { appLoading, footerIsLoading } = useDetailsContext();

  const { variant } = useSettings();

  return variant === "zerion" ? (
    <CollapsibleRoot>
      <CollapsibleTrigger>
        <Text>{t("details.additional_info")}</Text>

        <CollapsibleArrow />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Box paddingTop="4" paddingBottom="2">
          <MetaInfo isLoading={appLoading || footerIsLoading} />
        </Box>
      </CollapsibleContent>
    </CollapsibleRoot>
  ) : (
    <MetaInfo isLoading={appLoading || footerIsLoading} />
  );
};
