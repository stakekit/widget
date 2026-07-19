import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../app/config/use-widget-config";
import type { TronResource } from "../../../../../../../domain/schema/legacy-models";
import { getYieldActionArg } from "../../../../../../../domain/types/yields";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { Divider } from "../../../../../../widget-shell/divider";
import { Dropdown } from "../../../../../../widget-shell/ui/dropdown";
import { useEarnPageModel } from "../../state/earn-page-model";

export const ExtraArgsSelection = () => {
  const { selectedStake, tronResource, onTronResourceSelect, validation } =
    useEarnPageModel();

  const { t } = useTranslation();

  const isDashboard = useWidgetConfig("dashboardVariant");

  const tronResources = selectedStake
    ? getYieldActionArg(selectedStake, "enter", "tronResource")
    : null;
  if (!tronResources) return null;

  const options = (tronResources.options ?? []).map((v) => ({
    label: v,
    value: v as TronResource,
  }));

  const selectedOption = tronResource
    ? { value: tronResource, label: tronResource }
    : undefined;

  const isError = validation.submitted && validation.errors.tronResource;

  return (
    <Box>
      <Box my="2">
        <Text
          variant={{
            type: isError ? "danger" : "regular",
          }}
        >
          {t("details.tron_resources.label")}
        </Text>
      </Box>

      <Dropdown
        options={options}
        onSelect={(val) => onTronResourceSelect(val)}
        selectedOption={selectedOption}
        placeholder={t("details.tron_resources.placeholder")}
        isError={isError}
      />

      {!isDashboard && (
        <Box marginTop="3">
          <Divider />
        </Box>
      )}
    </Box>
  );
};
