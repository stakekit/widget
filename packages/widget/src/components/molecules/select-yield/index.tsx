import type { YieldDto } from "@stakekit/api-hooks";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMultiYields } from "../../../hooks/api/use-multi-yields";
import { Box } from "../../atoms/box";
import type { SelectModalProps } from "../../atoms/select-modal";
import {
  SelectModal,
  SelectModalItemContainer,
} from "../../atoms/select-modal";
import { VirtualList } from "../../atoms/virtual-list";
import { SelectOpportunityListItem } from "../select-opportunity-list-item";

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
