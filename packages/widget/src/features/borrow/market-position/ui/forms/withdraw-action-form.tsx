import { useTranslation } from "react-i18next";
import type { BorrowNetwork } from "../../../../../domain/borrow/network";
import { borrowTokenToAppToken } from "../../../../../shared/lib/borrow-token";
import { formatPercent, formatUsd } from "../../../../../shared/lib/formatters";
import { formatNumber } from "../../../../../shared/lib/number-format";
import {
  DetailRow,
  DetailsSection,
} from "../../../../../shared/ui/components/details-section";
import { TokenIcon } from "../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../shared/ui/primitives/box";
import { ListItem } from "../../../../../shared/ui/primitives/list/list-item";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { PageCtaButton } from "../../../../widget-shell/views";
import { BorrowNotice } from "../../../action-feedback/views";
import type {
  BorrowWithdrawActionContext,
  BorrowWithdrawTokenOption,
} from "../../../action-preparation/index";
import type { BorrowPositionAction } from "../../model/details";
import { useBorrowWithdrawForm } from "../../react/use-action-form";
import * as styles from "../styles.css";
import { AmountInputCard } from "./amount-input-card";
import { getBorrowPositionFormErrorMessage } from "./form-error";
import { useStartBorrowPositionReview } from "./use-start-review";

const WithdrawTokenPicker = ({
  onSelect,
  selectedToken,
  tokens,
  network,
}: {
  readonly network: BorrowNetwork;
  readonly onSelect: (token: BorrowWithdrawTokenOption) => void;
  readonly selectedToken: BorrowWithdrawTokenOption;
  readonly tokens: ReadonlyArray<BorrowWithdrawTokenOption>;
}) => {
  const { t } = useTranslation();

  if (tokens.length <= 1) {
    return null;
  }

  return (
    <DetailsSection
      title={t("dashboard.borrow.position_details.select_withdraw_token")}
    >
      <Box display="flex" flexDirection="column" gap="2">
        {tokens.map((token) => {
          const selected =
            token.action.args.tokenAddress ===
            selectedToken.action.args.tokenAddress;
          const tokenDto = borrowTokenToAppToken({
            network,
            token: token.collateralToken.token,
          });

          return (
            <ListItem key={token.action.args.tokenAddress}>
              <Box
                as="button"
                background="transparent"
                display="flex"
                gap="2"
                onClick={() => onSelect(token)}
                style={{ border: 0 }}
                type="button"
                width="full"
              >
                <TokenIcon token={tokenDto} />
                <Box flex={1} textAlign="left">
                  <Text variant={{ weight: "bold" }}>
                    {token.supplyBalance.tokenSymbol}
                  </Text>
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    {formatUsd(token.supplyBalance.balanceUsd.toString())}
                  </Text>
                </Box>
                {selected ? (
                  <Text>{t("dashboard.borrow.position_details.selected")}</Text>
                ) : null}
              </Box>
            </ListItem>
          );
        })}
      </Box>
    </DetailsSection>
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
  const error = getBorrowPositionFormErrorMessage({ error: view.error, t });

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <WithdrawTokenPicker
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

      <AmountInputCard
        amount={view.amount}
        balanceLabel={t("dashboard.borrow.position_details.withdrawable", {
          amount: formatNumber(selectedToken.availableAmount, 6),
          symbol: selectedToken.supplyBalance.tokenSymbol,
        })}
        error={error}
        label={t("dashboard.borrow.position_details.actions.withdraw")}
        onAmountChange={(amount) => dispatch({ amount, type: "amount/set" })}
        onMaxClick={() =>
          dispatch({
            amount: selectedToken.availableAmount,
            type: "amount/set",
          })
        }
        tokenSymbol={selectedToken.supplyBalance.tokenSymbol}
        usdValue={view.withdrawUsd}
      />

      {view.riskStatus === "unavailable" && view.amount.gt(0) ? (
        <BorrowNotice title={t("dashboard.borrow.risk_unavailable.title")}>
          {t("dashboard.borrow.risk_unavailable.description")}
        </BorrowNotice>
      ) : null}

      <Box className={styles.formCard}>
        <DetailRow
          id="ltv"
          label={t("dashboard.borrow.form.ltv_ratio")}
          value={`${formatPercent(view.currentLtv)} -> ${formatPercent(
            view.projectedLtv
          )}`}
        />
        <DetailRow
          id="collateral"
          label={t("dashboard.borrow.form.collateral_value")}
          value={`${formatUsd(
            view.currentCollateralUsd.toString()
          )} -> ${formatUsd(view.projectedCollateralUsd.toString())}`}
        />
      </Box>

      <PageCtaButton
        cta={{
          disabled: !view.canSubmit,
          isLoading: false,
          label: t("dashboard.borrow.review"),
          onClick: startReview,
        }}
      />
    </Box>
  );
};
