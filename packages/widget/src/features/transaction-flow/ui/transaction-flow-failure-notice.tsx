import type { Option, Schema } from "effect";
import { useTranslation } from "react-i18next";

import { Notice } from "../../../ui/index";
import { useWidgetRouteState } from "../../navigation/index";
import { TransactionFlowFailureState } from "../model/failure";

type FailureState = typeof TransactionFlowFailureState.Type;

/** A registry route a flow can leave for, carrying why it left. */
type FailureDestination = Readonly<{
  readonly withState: (
    schema: Schema.Codec<
      FailureState,
      typeof TransactionFlowFailureState.Encoded
    >
  ) => Readonly<{
    readonly state: (locationState: unknown) => Option.Option<FailureState>;
  }>;
}>;

/**
 * On the page a flow left for after its Execution could not start, `route`,
 * says so: the flow's navigation to it carried the reason.
 */
export const TransactionFlowFailureNotice = ({
  route,
}: {
  readonly route: FailureDestination;
}) => {
  const { t } = useTranslation();
  const failure = useWidgetRouteState(
    route.withState(TransactionFlowFailureState)
  );
  if (!failure) return null;
  return (
    <Notice
      tone="warning"
      title={t("transaction_steps.execution_unavailable.title")}
    >
      {t("transaction_steps.execution_unavailable.description")}
    </Notice>
  );
};
