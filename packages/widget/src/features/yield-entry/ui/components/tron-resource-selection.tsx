import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import type { TronResource } from "../../../../domain/action/tron-resource";
import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import { getYieldActionArg } from "../../../../domain/earn/yield";
import { Dropdown } from "../../../../shared/ui/components/dropdown";
import { Box } from "../../../../shared/ui/primitives/box";
import { Text } from "../../../../shared/ui/primitives/typography/text";

export const TronResourceSelection = ({
  children,
  isError,
  onSelect,
  selectedYield,
  value,
}: PropsWithChildren<{
  readonly selectedYield: EarnYieldWithProvider | null;
  readonly value: TronResource | null;
  readonly isError: boolean;
  readonly onSelect: (value: TronResource) => void;
}>) => {
  const { t } = useTranslation();

  const tronResources = selectedYield
    ? getYieldActionArg(selectedYield, "enter", "tronResource")
    : null;
  if (!tronResources) return null;

  const options = (tronResources.options ?? []).map((option) => ({
    label: option,
    value: option,
  }));
  const selectedOption = value ? { value, label: value } : undefined;

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
        onSelect={onSelect}
        selectedOption={selectedOption}
        placeholder={t("details.tron_resources.placeholder")}
        isError={isError}
      />

      {children}
    </Box>
  );
};
