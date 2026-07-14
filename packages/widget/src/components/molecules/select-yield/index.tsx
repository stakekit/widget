import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { YieldId } from "../../../domain/schema/identifiers";

import {
  MultiYieldsKey,
  visibleMultiYieldsAtom,
} from "../../../hooks/api/yield-atoms";
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
    onItemClick: (yieldDto: EarnYieldWithProvider) => void;
    providerYieldIds: ReadonlyArray<YieldId>;
    selectedYieldId?: YieldId;
  }
>;

export const SelectYield = ({
  state,
  onClose,
  onOpen,
  trigger,
  providerYieldIds,
  onItemClick,
  selectedYieldId,
  children,
}: SelectYieldProps) => {
  const { t } = useTranslation();

  const data =
    AsyncResult.getOrElse(
      useAtomValue(
        visibleMultiYieldsAtom(
          new MultiYieldsKey({
            enabled: providerYieldIds.length > 0,
            yieldIds: providerYieldIds,
          })
        )
      ),
      () => []
    ) ?? [];

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
                selected={item.id === selectedYieldId}
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
