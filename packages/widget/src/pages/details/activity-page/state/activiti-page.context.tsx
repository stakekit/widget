import type { SelectModalProps } from "@sk-widget/components";
import { useDefaultTokens } from "@sk-widget/hooks/api/use-default-tokens";
import type { ActivityPageContextType } from "@sk-widget/pages/details/activity-page/state/types";
import type { TokenBalanceScanResponseDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import {
  type PropsWithChildren,
  createContext,
  useContext,
  useDeferredValue,
  useMemo,
  useState,
} from "react";

const ActivityPageContext = createContext<ActivityPageContextType | undefined>(
  undefined
);

export const ActivityPageContextProvider = ({
  children,
}: PropsWithChildren) => {
  const { data: defaultTokens } = useDefaultTokens();
  const [tokenSearch, setTokenSearch] = useState("");
  const [selectedToken, setSelectedToken] =
    useState<TokenBalanceScanResponseDto>();

  const onTokenSearch: SelectModalProps["onSearch"] = (val) =>
    setTokenSearch(val);

  const onTokenSelect = (val: TokenBalanceScanResponseDto) =>
    setSelectedToken(val);

  const deferredTokenSearch = useDeferredValue(tokenSearch);

  const tokens = useMemo(
    () =>
      Maybe.fromNullable(defaultTokens)
        .map((tb1) => tb1)
        .chain((tb) =>
          Maybe.of(deferredTokenSearch)
            .chain((val) =>
              val.length >= 1 ? Maybe.of(val.toLowerCase()) : Maybe.empty()
            )
            .map((lowerSearch) =>
              tb.filter(
                (t) =>
                  t.token.name.toLowerCase().includes(lowerSearch) ||
                  t.token.symbol.toLowerCase().includes(lowerSearch)
              )
            )
            .alt(Maybe.of(tb))
        ),
    [defaultTokens, deferredTokenSearch]
  );

  const value = {
    defaultTokens: tokens,
    tokenSearch,
    onTokenSearch,
    onTokenSelect,
    selectedToken,
  };

  return (
    <ActivityPageContext.Provider value={value}>
      {children}
    </ActivityPageContext.Provider>
  );
};

export const useActivityPageContext = () => {
  const context = useContext(ActivityPageContext);

  if (!context) {
    throw new Error(
      "useActivityPageContext must be used within a ActivityPageContext"
    );
  }

  return context;
};
