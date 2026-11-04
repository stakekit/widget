import { Schema } from "effect";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TronResource } from "../../../../domain/action/tron-resource";
import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import { getYieldActionArg } from "../../../../domain/earn/yield";
import { Field, Select, Stack } from "../../../../ui/index";

const isTronResource = Schema.is(TronResource);

/**
 * The Tron resource a Yield Entry stakes for, when the yield asks for one;
 * `children` follow it, such as a divider, only then.
 */
export const TronResourceSelection = ({
  children,
  isError,
  onSelect,
  selectedYield,
  value,
}: {
  readonly children?: ReactNode;
  readonly selectedYield: EarnYieldWithProvider | null;
  readonly value: TronResource | null;
  readonly isError: boolean;
  readonly onSelect: (value: TronResource) => void;
}) => {
  const { t } = useTranslation();

  const tronResources = selectedYield
    ? getYieldActionArg(selectedYield, "enter", "tronResource")
    : null;
  if (!tronResources) return null;

  const options = (tronResources.options ?? [])
    .filter(isTronResource)
    .map((option) => ({ label: option, value: option }));
  const label = t("details.tron_resources.label");
  const placeholder = t("details.tron_resources.placeholder");

  return (
    <Stack gap={12}>
      <Field label={label} {...(isError ? { error: placeholder } : {})}>
        <Select
          options={options}
          value={value}
          onValueChange={onSelect}
          label={label}
          placeholder={placeholder}
        />
      </Field>
      {children}
    </Stack>
  );
};
