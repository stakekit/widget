import { useTranslation } from "react-i18next";
import { Box, ListRow } from "../../../../../../ui/index";
import type { ActivityActionItem } from "../../../../model/activity-action";
import { ActivityAvatar } from "../../../components/activity-avatar";
import { toActivityStatusCallout } from "../../../components/activity-status";
import { useActionListItem } from "../../hooks/use-action-list-item";

/**
 * An action on two lines, under the header of its day: its token badged with
 * what it did, what happened beside its amount, then who ran it and its
 * status unless it completed, beside when: how long ago within a day, its
 * time of day after that. An action that failed or was canceled strikes its
 * amount, which never moved, and says when it ended. Its full date and time
 * are the receipt's. An amount whose token is unknown shows in USD, never as
 * a bare number.
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
    direction,
    token,
    title,
    amountText,
    timestamp,
    statusText,
    statusLabel,
    voided,
  } = listItemView;

  const firstProvider = providersDetails?.[0];
  const viaLabel = firstProvider
    ? t("positions.via", {
        providerName: firstProvider.name ?? firstProvider.address,
        count: Math.max((providersDetails?.length ?? 0) - 1, 1),
      })
    : undefined;
  const status = toActivityStatusCallout(statusLabel, statusText);

  // Amounts stay neutral: green is for positive rates and claimable amounts.
  return (
    <Box paddingBlock={4} width="full">
      <ListRow
        leading={<ActivityAvatar direction={direction} token={token} />}
        title={title}
        {...(viaLabel === undefined ? {} : { subtitle: viaLabel })}
        {...(status === null ? {} : { status })}
        {...(amountText === null
          ? {}
          : { value: amountText, valueStruck: voided })}
        {...(timestamp === "" ? {} : { subvalue: timestamp })}
        onClick={() => onActionSelect(action)}
        selected={isSelected}
        testId={
          isSelected ? "activity-list-item-selected" : "activity-list-item"
        }
      />
    </Box>
  );
};
