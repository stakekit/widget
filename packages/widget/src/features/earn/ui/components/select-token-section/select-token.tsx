import { useTranslation } from "react-i18next";
import { equalTokens } from "../../../../../domain/token/token";
import { SelectModal } from "../../../../../shared/ui/components/select-modal";
import {
  SelectedToken,
  SelectTokenTrigger,
} from "../../../../../shared/ui/components/selected-token";
import { VirtualList } from "../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../../tracking/index";
import {
  useEarnEntry,
  useEarnTokenSelection,
} from "../../../react/use-earn-facades";
import { SelectTokenListItem } from "./select-token-list-item";

export const SelectToken = ({ canSelect = true }: { canSelect?: boolean }) => {
  const { select, setSearch, view } = useEarnTokenSelection();
  const { view: entry } = useEarnEntry();
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
      trigger={<SelectTokenTrigger testId="select-token" token={data.st} />}
    >
      {data.tokenBalances.length === 0 && view.search.trim().length > 0 ? (
        <Box display="flex" justifyContent="center" px="4" py="4">
          <Text variant={{ type: "muted" }}>
            {t("select_token.no_results")}
          </Text>
        </Box>
      ) : (
        <VirtualList
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
