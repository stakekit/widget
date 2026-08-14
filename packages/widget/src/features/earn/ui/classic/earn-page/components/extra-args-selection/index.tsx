import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../app/composition/use-widget-config";
import { getYieldActionArg } from "../../../../../../../domain/earn/yield";
import { Divider } from "../../../../../../../shared/ui/components/divider";
import { Dropdown } from "../../../../../../../shared/ui/components/dropdown";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { useEarnEntry } from "../../../../../react/use-earn-facades";

export const ExtraArgsSelection = () => {
  const { selectTronResource, view } = useEarnEntry();
  const { selectedStake, tronResource, validation } = view;

  const { t } = useTranslation();

  const isDashboard = useWidgetConfig("dashboardVariant");

  const tronResources = selectedStake
    ? getYieldActionArg(selectedStake, "enter", "tronResource")
    : null;
  if (!tronResources) return null;

  const options = (tronResources.options ?? []).map((v) => ({
    label: v,
    value: v,
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
        onSelect={selectTronResource}
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
