import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Box, Disclosure } from "../../../../ui/index";
import type { PositionItem } from "../../state/read-models/positions";

/**
 * The positions worth less than a cent, collapsed at the end of a positions
 * list under "Small balances (N)": each renders as its list's row once open.
 */
export const SmallBalances = ({
  items,
  renderItem,
}: {
  readonly items: ReadonlyArray<PositionItem>;
  readonly renderItem: (item: PositionItem) => ReactNode;
}) => {
  const { t } = useTranslation();

  return (
    <Box paddingBlock={4}>
      <Disclosure
        title={t("positions.small_balances", { count: items.length })}
        testId="positions__small-balances"
      >
        {items.map((item) => (
          <Fragment key={`${item.integrationId}:${item.balanceId}`}>
            {renderItem(item)}
          </Fragment>
        ))}
      </Disclosure>
    </Box>
  );
};
