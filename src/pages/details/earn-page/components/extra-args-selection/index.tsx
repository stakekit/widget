import { useTranslation } from "react-i18next";
import { Dropdown } from "../../../../../components/atoms/dropdown";
import { useDetailsContext } from "../../state/details-context";
import { Box, Divider, Text } from "../../../../../components";
import type { TronResourceType } from "@stakekit/api-hooks";

export const ExtraArgsSelection = () => {
  const { selectedStake, tronResource, onTronResourceSelect, validation } =
    useDetailsContext();

  const { t } = useTranslation();

  return selectedStake
    .chainNullable((ss) => ss.args.enter.args?.tronResource)
    .map((tronResources) => {
      const options = tronResources.options.map((v) => ({
        label: v,
        value: v as TronResourceType,
      }));

      const selectedOption = tronResource
        .map((v) => ({ value: v, label: v }))
        .extract();

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

          <Box marginTop="3">
            <Divider />
          </Box>
        </Box>
      );
    })
    .extractNullable();
};
