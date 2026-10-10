import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  SelectModal,
  SelectModalItem,
  SelectModalItemContainer,
} from "../../../../shared/ui/components/select-modal";
import { Box } from "../../../../shared/ui/primitives/box";
import { Image } from "../../../../shared/ui/primitives/image";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useEarnProviderOptions } from "../../react/use-earn-facades";
import type { EarnProviderOption } from "../../state/earn-selection/types";
import { providerOptionName } from "./earn-provider-option-selection.css";

export type EarnProviderOptionTriggerState = {
  /** `true` when the trigger must render a dialog `Trigger` to open the option list. */
  readonly canSelect: boolean;
  readonly selectedOption: EarnProviderOption | null;
  readonly title: string;
};

/**
 * Renders the yield's advertised `providerId` options: nothing without options,
 * the trigger alone for a single option, and the trigger plus a selectable
 * option list for several options. Callers own the trigger styling.
 */
export const EarnProviderOptionSelection = ({
  loading = null,
  renderTrigger,
}: {
  readonly loading?: ReactNode;
  readonly renderTrigger: (state: EarnProviderOptionTriggerState) => ReactNode;
}) => {
  const { select, view } = useEarnProviderOptions();
  const { t } = useTranslation();

  if (view.appLoading) return loading;

  if (view.items.length === 0) return null;

  const title = t("details.provider_search_title");
  const selectedOption =
    view.items.find((option) => option.value === view.selected) ?? null;

  if (!view.canSelect) {
    return renderTrigger({ canSelect: false, selectedOption, title });
  }

  return (
    <SelectModal
      title={title}
      trigger={renderTrigger({ canSelect: true, selectedOption, title })}
    >
      <Box marginTop="4">
        {view.items.map((option) => {
          const name = option.provider?.name ?? option.value;

          return (
            <SelectModalItemContainer key={option.value}>
              <SelectModalItem
                testId={`select-provider-option-${option.value}`}
                selected={option.value === view.selected}
                onItemClick={({ closeModal }) => {
                  select(option.value);
                  closeModal();
                }}
              >
                <Image
                  wrapperProps={{ hw: "8", flexShrink: 0 }}
                  imgProps={{ borderRadius: "base" }}
                  src={option.provider?.logoURI}
                  fallbackName={name}
                />

                <Box flex={1} marginLeft="2" minWidth="0">
                  <Text
                    className={providerOptionName}
                    variant={{ weight: "bold" }}
                  >
                    {name}
                  </Text>
                </Box>
              </SelectModalItem>
            </SelectModalItemContainer>
          );
        })}
      </Box>
    </SelectModal>
  );
};
