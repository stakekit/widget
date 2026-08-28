import { Trigger } from "@radix-ui/react-dialog";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { equalTokens } from "../../../../../../../domain/token/token";
import { useWidgetConfig } from "../../../../../../../features/widget-configuration/index";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import { SelectModal } from "../../../../../../../shared/ui/components/select-modal";
import { SelectedToken } from "../../../../../../../shared/ui/components/selected-token";
import { TokenIcon } from "../../../../../../../shared/ui/components/token-icon";
import { VirtualList } from "../../../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import {
  pressAnimation,
  selectTokenButton,
} from "../../../../../../../shared/ui/primitives/button/styles.css";
import { CaretDownIcon } from "../../../../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../../../../tracking/index";
import {
  useEarnEntry,
  useEarnTokenSelection,
} from "../../../../../react/use-earn-facades";
import { validatorVirtuosoContainer } from "../../styles.css";
import { SelectTokenListItem } from "./select-token-list-item";

export const SelectToken = ({ canSelect = true }: { canSelect?: boolean }) => {
  const { select, setSearch, view } = useEarnTokenSelection();
  const { view: entry } = useEarnEntry();

  const variant = useWidgetConfig("variant");

  const trackEvent = useTrackEvent();

  const { t } = useTranslation();

  const data = entry.selectedToken
    ? { st: entry.selectedToken, tokenBalances: view.filtered }
    : null;

  if (!data) return null;

  if (!canSelect) {
    return <SelectedToken token={data.st} />;
  }

  return (
    <SelectModal
      title={t("select_token.title")}
      onSearch={setSearch}
      searchValue={view.search}
      onClose={() => setSearch("")}
      onOpen={() => trackEvent("selectTokenModalOpened")}
      trigger={
        <Trigger asChild>
          <Box
            as="button"
            display="flex"
            justifyContent="center"
            alignItems="center"
            borderRadius="2xl"
            px="2"
            py="1"
            data-testid="select-token"
            className={clsx(
              pressAnimation,
              combineRecipeWithVariant({
                variant,
                rec: selectTokenButton,
              })
            )}
          >
            <Box
              marginRight="2"
              display="flex"
              justifyContent="center"
              alignItems="center"
            >
              <TokenIcon token={data.st} />
              <Text variant={{ weight: "bold" }}>{data.st.symbol}</Text>
            </Box>
            <CaretDownIcon />
          </Box>
        </Trigger>
      }
    >
      {data.tokenBalances.length === 0 && view.search.trim().length > 0 ? (
        <Box display="flex" justifyContent="center" px="4" py="4">
          <Text variant={{ type: "muted" }}>
            {t("select_token.no_results")}
          </Text>
        </Box>
      ) : (
        <VirtualList
          className={validatorVirtuosoContainer}
          data={data.tokenBalances}
          estimateSize={() => 60}
          itemContent={(_index, item) => {
            return (
              <SelectTokenListItem
                item={item}
                isSelected={equalTokens(item.token, data.st)}
                onTokenBalanceSelect={select}
              />
            );
          }}
        />
      )}
    </SelectModal>
  );
};
