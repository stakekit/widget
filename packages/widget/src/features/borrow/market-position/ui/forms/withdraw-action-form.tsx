import { useTranslation } from "react-i18next";
import type { BorrowNetwork } from "../../../../../domain/borrow/network";
import { borrowTokenToAppToken } from "../../../../../shared/lib/borrow-token";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import {
  useTokenLogo,
  useTokenLogoResolver,
} from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  Card,
  DetailList,
  DetailRow,
  Notice,
  SelectSheet,
  Stack,
  TokenTrigger,
} from "../../../../../ui/index";
import { PageCtaButton } from "../../../../widget-shell/views";
import type {
  BorrowWithdrawActionContext,
  BorrowWithdrawTokenOption,
} from "../../../action-preparation/index";
import type { BorrowPositionAction } from "../../model/details";
import { useBorrowWithdrawForm } from "../../react/use-action-form";
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
  const { locale } = useWidgetPresentation();
  const resolveLogo = useTokenLogoResolver();
  const selectedLogo = useTokenLogo(
    borrowTokenToAppToken({
      network,
      token: selectedToken.collateralToken.token,
    })
  );

  return (
    <SelectSheet
      testIds={{
        container: "select-modal__container",
        title: "select-modal__title",
      }}
      title={t("dashboard.borrow.position_details.select_withdraw_token")}
      closeLabel={t("shared.close")}
      listLabel={t("dashboard.borrow.form.collateral_assets")}
      trigger={
        <TokenTrigger
          testId="borrow-withdraw-token-select"
          token={selectedLogo}
        />
      }
      selectedId={selectedToken.action.args.tokenAddress}
      onSelect={(id) => {
        const token = tokens.find(
          (candidate) => candidate.action.args.tokenAddress === id
        );
        if (token) onSelect(token);
      }}
      options={tokens.map((token) => {
        const { tokenAddress } = token.action.args;

        return {
          id: tokenAddress,
          testId: `borrow-withdraw-token-select__item_${tokenAddress}`,
          title: token.supplyBalance.tokenSymbol,
          value: formatTokenAmount(token.availableAmount, locale, "down"),
          subvalue: formatUsd(
            token.supplyBalance.balanceUsd.toString(),
            locale
          ),
          logo: resolveLogo(
            borrowTokenToAppToken({
              network,
              token: token.collateralToken.token,
            })
          ),
        };
      })}
    />
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
  const { locale } = useWidgetPresentation();
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
    <Stack gap={16}>
      <AmountInputCard
        amount={view.amount}
        balanceLabel={t("dashboard.borrow.position_details.withdrawable", {
          amount: formatTokenAmount(
            selectedToken.availableAmount,
            locale,
            "down"
          ),
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

      <Card padding={16}>
        <DetailList>
          <LtvTransitionRow
            currentLtv={view.currentLtv}
            projectedLtv={view.projectedLtv}
          />
          <DetailRow
            label={t("dashboard.borrow.form.collateral_value")}
            value={`${formatUsd(
              view.currentCollateralUsd.toString(),
              locale
            )} -> ${formatUsd(view.projectedCollateralUsd.toString(), locale)}`}
          />
        </DetailList>
      </Card>

      {view.riskBlock ? (
        <Notice tone="danger" title={t("dashboard.borrow.risk_block.title")}>
          {t(`dashboard.borrow.risk_block.${view.riskBlock}`)}
        </Notice>
      ) : null}

      <PageCtaButton
        cta={{
          disabled: !view.canSubmit,
          isLoading: false,
          label: t("dashboard.borrow.review_actions.withdraw"),
          onClick: startReview,
        }}
      />
    </Stack>
  );
};
