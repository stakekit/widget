import { useTranslation } from "react-i18next";

import type { MarketPosition } from "../../../../../domain/borrow/market-position";
import { formatAddress } from "../../../../../shared/lib/general";
import {
  DetailList,
  DetailRow,
  Disclosure,
  Stack,
} from "../../../../../ui/index";
import type {
  BorrowPositionAction,
  BorrowPositionDetailsModel,
} from "../../model/details";
import { CollateralList } from "./collateral-list";

/**
 * Everything past the summary, open at first: the collateral with its switches,
 * then the borrowed amount, the market's terms and the pool's address.
 */
export const BorrowPositionDetailsDisclosure = ({
  actions,
  model,
  onActionSelect,
  position,
}: {
  readonly actions: BorrowPositionAction[];
  readonly model: BorrowPositionDetailsModel;
  readonly onActionSelect: (action: BorrowPositionAction) => void;
  readonly position: MarketPosition;
}) => {
  const { t } = useTranslation();

  return (
    <Disclosure
      title={t("position_details.details")}
      testId="borrow-position-details-disclosure"
      defaultOpen
    >
      <Stack gap={16}>
        <CollateralList
          actions={actions}
          items={model.collateralItems}
          onActionSelect={onActionSelect}
        />
        <DetailList>
          {model.detailRows.map((row) => (
            <DetailRow key={row.id} label={row.label} value={row.value} />
          ))}
          <DetailRow
            label={t("dashboard.borrow.details.pool_address")}
            value={formatAddress(position.market.poolAddress)}
            copyable={{
              value: position.market.poolAddress,
              label: t("wallet_modal.copy_address"),
              copiedLabel: t("wallet_modal.copied"),
            }}
          />
        </DetailList>
      </Stack>
    </Disclosure>
  );
};
