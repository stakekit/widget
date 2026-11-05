import { useTranslation } from "react-i18next";
import { Box, ListRow } from "../../../../../../ui/index";
import type { ActivityActionItem } from "../../../../model/activity-action";
import { toActivityStatusCallout } from "../../../components/activity-status";
import { useActionListItem } from "../../hooks/use-action-list-item";
import { ActivityIcon } from "../activity-icon";

/**
 * An action on two lines: what happened beside its amount, then who ran it
 * and its status unless it completed, beside how long ago. Its full date is
 * the receipt's.
 */
export const ActionListItem = ({
  action,
  isSelected = false,
  onActionSelect,
}: {
  readonly action: ActivityActionItem;
  readonly isSelected?: boolean;
  readonly onActionSelect: (action: ActivityActionItem) => void;
}) => {
  const { t } = useTranslation();
  const listItemView = useActionListItem(action);

  if (!listItemView) return null;

  const {
    providersDetails,
    iconType,
    title,
    amountTokenSymbol,
    amount,
    amountSign,
    timestampRelative,
    statusText,
    statusLabel,
  } = listItemView;

  const firstProvider = providersDetails?.[0];
  const viaLabel = firstProvider
    ? t("positions.via", {
        providerName: firstProvider.name ?? firstProvider.address,
        count: Math.max((providersDetails?.length ?? 0) - 1, 1),
      })
    : undefined;
  const status = toActivityStatusCallout(statusLabel, statusText);
  // Green is for positive rates and claimable amounts only, so amounts stay
  // neutral.
  const amountText = amount
    ? [`${amountSign}${amount}`, amountTokenSymbol].filter(Boolean).join(" ")
    : undefined;

  return (
    <Box paddingBlock={4} width="full">
      <ListRow
        leading={<ActivityIcon type={iconType} />}
        title={title}
        {...(viaLabel === undefined ? {} : { subtitle: viaLabel })}
        {...(status === null ? {} : { status })}
        {...(amountText === undefined ? {} : { value: amountText })}
        {...(timestampRelative === "" ? {} : { subvalue: timestampRelative })}
        onClick={() => onActionSelect(action)}
        selected={isSelected}
        testId={
          isSelected ? "activity-list-item-selected" : "activity-list-item"
        }
      />
    </Box>
  );
};
