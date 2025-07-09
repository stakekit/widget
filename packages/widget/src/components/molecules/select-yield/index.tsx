import { Box } from "@sk-widget/components/atoms/box";
import { VirtualList } from "@sk-widget/components/atoms/virtual-list";
import { SelectOpportunityListItem } from "@sk-widget/components/molecules/select-opportunity-list-item";
import { useMultiYields } from "@sk-widget/hooks/api/use-multi-yields";
import type { YieldDto } from "@stakekit/api-hooks";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SelectModalProps } from "../../atoms/select-modal";
import {
  SelectModal,
  SelectModalItemContainer,
} from "../../atoms/select-modal";

type SelectYieldProps = PropsWithChildren<
  Pick<SelectModalProps, "onClose" | "onOpen" | "state" | "trigger"> & {
    onItemClick: (yieldDto: YieldDto) => void;
    providerYieldIds: YieldDto["id"][];
  }
>;

export const SelectYield = ({
  state,
  onClose,
  onOpen,
  trigger,
  providerYieldIds,
  onItemClick,
  children,
}: SelectYieldProps) => {
  const { t } = useTranslation();

  const multiYields = useMultiYields(providerYieldIds);

  const data = useMemo(() => multiYields.data ?? [], [multiYields.data]);

  return (
    <SelectModal
      title={t("details.provider_search_title")}
      onClose={onClose}
      onOpen={onOpen}
      trigger={trigger}
      state={state}
    >
      <Box marginTop="4">
        <VirtualList
          data={data}
          itemContent={(_, item) => (
            <SelectModalItemContainer>
              <SelectOpportunityListItem
                item={item}
                onYieldSelect={onItemClick}
              />
            </SelectModalItemContainer>
          )}
          estimateSize={() => 40}
        />
      </Box>

      {children}
    </SelectModal>
  );
};
