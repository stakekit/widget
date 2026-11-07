import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { SelectSheet } from "../../../../ui/index";
import { useEarnProviderOptions } from "../../react/use-earn-facades";
import type { EarnProviderOption } from "../../state/earn-selection/types";

export type EarnProviderOptionTriggerState = {
  /** `true` when the trigger offers to `open` the option list. */
  readonly canSelect: boolean;
  readonly selectedOption: EarnProviderOption | null;
  readonly title: string;
  /** Opens the option list; focus returns to the opener on close. */
  readonly open: () => void;
};

/**
 * Renders the yield's advertised `providerId` options: nothing without options,
 * the trigger alone for a single option, and the trigger plus a selectable
 * option list for several options. Callers own the trigger.
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
  const [open, setOpen] = useState(false);

  if (view.appLoading) return loading;

  if (view.items.length === 0) return null;

  const title = t("details.provider_search_title");
  const selectedOption =
    view.items.find((option) => option.value === view.selected) ?? null;

  if (!view.canSelect) {
    return renderTrigger({
      canSelect: false,
      open: () => undefined,
      selectedOption,
      title,
    });
  }

  return (
    <>
      {renderTrigger({
        canSelect: true,
        open: () => setOpen(true),
        selectedOption,
        title,
      })}
      <SelectSheet
        title={title}
        closeLabel={t("shared.close")}
        listLabel={title}
        open={open}
        onOpenChange={setOpen}
        options={view.items.map((option) => {
          const name = option.provider?.name ?? option.value;
          return {
            id: option.value,
            testId: `select-provider-option-${option.value}`,
            title: name,
            logo: {
              name,
              ...(option.provider?.logoURI
                ? { src: option.provider.logoURI }
                : {}),
            },
          };
        })}
        {...(view.selected === null ? {} : { selectedId: view.selected })}
        onSelect={(id) => {
          const option = view.items.find((item) => item.value === id);
          if (option) select(option.value);
        }}
      />
    </>
  );
};
