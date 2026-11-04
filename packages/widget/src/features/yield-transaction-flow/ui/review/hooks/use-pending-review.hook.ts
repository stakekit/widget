import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { toLowerCase } from "effect/String";
import { useTranslation } from "react-i18next";
import { getPendingActionLabelContext } from "../../../../../domain/action/pending-action";
import { isConfidentialYield } from "../../../../../domain/earn/confidential";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { getGasFeeInUSD } from "../../../../../shared/lib/formatters";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import type { PageCta } from "../../../../widget-shell/views";
import {
  useYieldFlowIntake,
  useYieldFlowReview,
} from "../../../react/yield-flow-route";
import type { MetaInfoProps } from "../pages/common.page.tsx";

export const usePendingActionReview = () => {
  const manageFlow = useYieldFlowIntake("Manage");
  const facade = useYieldFlowReview();
  const confirmFlow = useAtomSet(facade.confirmAtom);
  const review = useAtomValue(facade.reviewViewAtom);
  const pendingTxGas = review.gasAmount;

  // A cancel returns what was committed, its Shares when there are any; one
  // taking an amount shows that amount in the balance's Value Token.
  const returnToken = manageFlow.cancelReturn?.token ?? null;
  const requestAmount = manageFlow.request.arguments?.amount;
  const shown = requestAmount
    ? {
        amount: exactDecimal(requestAmount),
        token: manageFlow.interactedToken,
      }
    : (manageFlow.cancelReturn ?? {
        amount: exactDecimal(0),
        token: manageFlow.interactedToken,
      });
  const amount = shown.amount;
  const interactedToken = shown.token;
  const integrationData = manageFlow.integration;

  const prices = review.prices;

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  const labelContext = getPendingActionLabelContext(
    manageFlow.request.action,
    manageFlow.balanceType,
    { confidential: isConfidentialYield(integrationData) }
  );
  const title = t(
    `position_details.pending_action_button.${toLowerCase(
      manageFlow.request.action
    )}` as const,
    labelContext === undefined ? {} : { context: labelContext }
  );

  const fee = getGasFeeInUSD({
    gas: pendingTxGas,
    locale,
    prices,
    yieldDto: integrationData,
  });

  const onClick = () => confirmFlow(undefined);

  const resolveCta = (): PageCta => ({
    label: t("shared.confirm"),
    onClick,
    disabled: false,
    isLoading: review.confirmLoading,
  });

  const metaInfo: MetaInfoProps = { showMetaInfo: false };
  const facts = returnToken
    ? [{ label: t("review.receive_token"), value: returnToken.symbol }]
    : [];

  // An encrypted balance has no known amount until it is revealed.
  const formattedAmount = manageFlow.balanceHidden
    ? t("shared.confidential.hidden")
    : formatTokenAmount(amount, locale, "down");

  return {
    integrationData,
    title,
    amount: formattedAmount,
    facts,
    fee,
    token: interactedToken,
    metaInfo,
    isGasCheckWarning: review.isGasCheckWarning,
    gasCheckLoading: review.gasCheckLoading,
    cta: resolveCta(),
  };
};
