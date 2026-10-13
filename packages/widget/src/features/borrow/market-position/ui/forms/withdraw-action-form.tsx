import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { BorrowNetwork } from "../../../../../domain/borrow/network";
import { borrowTokenToAppToken } from "../../../../../shared/lib/borrow-token";
import { formatUsd } from "../../../../../shared/lib/formatters";
import { formatNumber } from "../../../../../shared/lib/number-format";
import {
  DetailRow,
  DetailRowList,
} from "../../../../../shared/ui/components/details-section";
import { SelectModal } from "../../../../../shared/ui/components/select-modal";
import { SelectTokenTrigger } from "../../../../../shared/ui/components/selected-token";
import { Box } from "../../../../../shared/ui/primitives/box";
import { PageCtaButton } from "../../../../widget-shell/views";
import type {
  BorrowWithdrawActionContext,
  BorrowWithdrawTokenOption,
} from "../../../action-preparation/index";
import {
  BorrowAssetSelectorList,
  BorrowAssetSelectorRow,
} from "../../../borrow-entry/views";
import type { BorrowPositionAction } from "../../model/details";
import { useBorrowWithdrawForm } from "../../react/use-action-form";
import * as styles from "../styles.css";
import { AmountInputCard } from "./amount-input-card";
import { getBorrowPositionFormWarningMessage } from "./form-warning";
import { LtvTransitionRow } from "./ltv-transition-row";
import { useStartBorrowPositionReview } from "./use-start-review";

const WithdrawTokenSelect = ({
  network,
  onSelect,
  selectedToken,
  tokens,
}: {
  readonly network: BorrowNetwork;
  readonly onSelect: (token: BorrowWithdrawTokenOption) => void;
  readonly selectedToken: BorrowWithdrawTokenOption;
  readonly tokens: ReadonlyArray<BorrowWithdrawTokenOption>;
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SelectModal
      state={{ isOpen, setOpen: setIsOpen }}
      title={t("dashboard.borrow.position_details.select_withdraw_token")}
      trigger={
        <SelectTokenTrigger
          testId="borrow-withdraw-token-select"
          token={borrowTokenToAppToken({
            network,
            token: selectedToken.collateralToken.token,
          })}
        />
      }
    >
      <BorrowAssetSelectorList
        columnLabel={t("dashboard.borrow.form.balance_column")}
        title={t("dashboard.borrow.form.collateral_assets")}
      >
        {tokens.map((token) => {
          const { tokenAddress } = token.action.args;

          return (
            <BorrowAssetSelectorRow
              key={tokenAddress}
              label={token.supplyBalance.tokenSymbol}
              onClick={() => {
                onSelect(token);
                setIsOpen(false);
              }}
              rate={formatNumber(token.availableAmount, 6)}
              rateMeta={formatUsd(token.supplyBalance.balanceUsd.toString())}
              selected={tokenAddress === selectedToken.action.args.tokenAddress}
              testId={`borrow-withdraw-token-select__item_${tokenAddress}`}
              token={borrowTokenToAppToken({
                network,
                token: token.collateralToken.token,
              })}
            />
          );
        })}
      </BorrowAssetSelectorList>
    </SelectModal>
  );
};

export const WithdrawActionForm = ({
  action,
  context,
}: {
  readonly action: BorrowPositionAction;
  readonly context: BorrowWithdrawActionContext;
}) => {
  const { t } = useTranslation();
  const startReview = useStartBorrowPositionReview(action);
  const [view, dispatch] = useBorrowWithdrawForm(action);

  if (!view) {
    return null;
  }

  const { position } = context;
  const { selectedToken } = view;
  const warning = getBorrowPositionFormWarningMessage({
    warning: view.warning,
    t,
  });

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <AmountInputCard
        amount={view.amount}
        balanceLabel={t("dashboard.borrow.position_details.withdrawable", {
          amount: formatNumber(selectedToken.availableAmount, 6),
          symbol: selectedToken.supplyBalance.tokenSymbol,
        })}
        label={t("dashboard.borrow.position_details.actions.withdraw")}
        onAmountChange={(amount) => dispatch({ amount, type: "amount/set" })}
        onMaxClick={() =>
          dispatch({
            amount: selectedToken.availableAmount,
            type: "amount/set",
          })
        }
        tokenSelector={
          context.tokens.length > 1 ? (
            <WithdrawTokenSelect
              network={position.market.network}
              onSelect={(token) =>
                dispatch({
                  tokenAddress: token.action.args.tokenAddress,
                  type: "token/select",
                })
              }
              selectedToken={selectedToken}
              tokens={context.tokens}
            />
          ) : undefined
        }
        tokenSymbol={selectedToken.supplyBalance.tokenSymbol}
        usdValue={view.withdrawUsd}
        warning={warning}
      />

      <Box className={styles.formCard}>
        <DetailRowList>
          <LtvTransitionRow
            currentLtv={view.currentLtv}
            projectedLtv={view.projectedLtv}
          />
          <DetailRow
            id="collateral"
            label={t("dashboard.borrow.form.collateral_value")}
            value={`${formatUsd(
              view.currentCollateralUsd.toString()
            )} -> ${formatUsd(view.projectedCollateralUsd.toString())}`}
          />
        </DetailRowList>
      </Box>

      <PageCtaButton
        cta={{
          disabled: !view.canSubmit,
          isLoading: false,
          label: t("dashboard.borrow.review_actions.withdraw"),
          onClick: startReview,
        }}
      />
    </Box>
  );
};
