import { useTranslation } from "react-i18next";
import { Dropdown } from "../../../../../components/atoms/dropdown";
import { useDetailsContext } from "../../state/details-context";
import { Box, Divider, Text } from "../../../../../components";
import {
  TronResourceArgumentOptionsDto,
  TronResourceType,
} from "@stakekit/api-hooks";

export const ExtraArgsSelection = () => {
  const { selectedStake, tronResource, onTronResourceSelect } =
    useDetailsContext();

  const { t } = useTranslation();

  return selectedStake
    .chainNullable(
      (ss) =>
        ss.args.enter.args?.tronResource as
          | TronResourceArgumentOptionsDto
          | undefined
    )
    .map((tronResources) => {
      const options = tronResources.options.map((v) => ({
        label: v,
        value: v as TronResourceType,
      }));

      const selectedOption = tronResource
        .map((v) => ({ value: v, label: v }))
        .extract();

      return (
        <Box>
          <Box my="2">
            <Text>{t("details.tron_resources.label")}</Text>
          </Box>

          <Dropdown
            options={options}
            onSelect={(val) => onTronResourceSelect(val)}
            selectedOption={selectedOption}
            placeholder={t("details.tron_resources.placeholder")}
          />

          <Box marginTop="3">
            <Divider />
          </Box>
        </Box>
      );
    })
    .extractNullable();
};
