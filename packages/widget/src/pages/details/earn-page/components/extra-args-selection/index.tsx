import { useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import { Divider } from "../../../../../components/atoms/divider";
import { Dropdown } from "../../../../../components/atoms/dropdown";
import { Text } from "../../../../../components/atoms/typography/text";
import type { TronResource } from "../../../../../domain/schema/legacy-models";

import { getYieldActionArg } from "../../../../../domain/types/yields";
import { useIsDashboard } from "../../../../../pages-dashboard/providers/dashboard-context";
import { useEarnPageContext } from "../../state/earn-page-context";

export const ExtraArgsSelection = () => {
  const { selectedStake, tronResource, onTronResourceSelect, validation } =
    useEarnPageContext();

  const { t } = useTranslation();

  const isDashboard = useIsDashboard();

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
