import { useTranslation } from "react-i18next";
import { Badge, Box, ListRow, type Tone } from "../../../../../../ui/index";
import type { ActivityActionItem } from "../../../../model/activity-action";
import type { ActivityStatusLabel } from "../../../../model/activity-action-list-item";
import { useActionListItem } from "../../hooks/use-action-list-item";
import { ActivityIcon } from "../activity-icon";

// Statuses that ask nothing of the user are not highlighted.
const statusTone = (status: ActivityStatusLabel): Tone => {
  switch (status) {
    case "completed":
    case "awaiting_settlement":
      return "neutral";
    case "failed":
      return "danger";
    default:
      return "warning";
  }
};

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
    timestampAbsolute,
    timestampRelative,
    badgeLabel,
    statusLabel,
  } = listItemView;

  const firstProvider = providersDetails?.[0];
  const viaLabel = firstProvider
    ? t("positions.via", {
        providerName: firstProvider.name ?? firstProvider.address,
        count: Math.max((providersDetails?.length ?? 0) - 1, 1),
      })
    : undefined;
  const amountFigure:
    | {
        readonly text: string;
        readonly from: "sm";
      }
    | undefined = amount
    ? {
        text: amountTokenSymbol
          ? `${amountSign}${amount} ${amountTokenSymbol}`
          : `${amountSign}${amount}`,
        // A narrow row keeps its room for the title and the time. Green is
        // for positive rates and claimable amounts only, so amounts stay neutral.
        from: "sm",
      }
    : undefined;

  return (
    <Box paddingBlock={4} width="full">
      <ListRow
        leading={<ActivityIcon type={iconType} />}
        title={title}
        {...(viaLabel === undefined ? {} : { subtitle: viaLabel })}
        {...(badgeLabel && statusLabel
          ? {
              badges: (
                <Badge tone={statusTone(statusLabel)}>{badgeLabel}</Badge>
              ),
            }
          : {})}
        {...(amountFigure === undefined ? {} : { figure: amountFigure })}
        {...(timestampAbsolute ? { value: timestampAbsolute } : {})}
        {...(timestampRelative ? { subvalue: timestampRelative } : {})}
        onClick={() => onActionSelect(action)}
        selected={isSelected}
        testId={
          isSelected ? "activity-list-item-selected" : "activity-list-item"
        }
      />
    </Box>
  );
};
