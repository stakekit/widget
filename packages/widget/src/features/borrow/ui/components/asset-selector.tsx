import { Trigger } from "@radix-ui/react-dialog";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useWidgetConfig } from "../../../../app/config/use-widget-config";
import { combineRecipeWithVariant } from "../../../../shared/styles/recipe-variant";
import { TokenIcon } from "../../../../shared/ui/components/token-icon";
import { Box } from "../../../../shared/ui/primitives/box";
import {
  pressAnimation,
  selectTokenButton,
} from "../../../../shared/ui/primitives/button/styles.css";
import { CaretDownIcon } from "../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import type { DashboardBorrowToken } from "../../model/market-groups";
import * as styles from "../styles.css";

const AmountTokenButtonContent = ({
  showCaret,
  token,
}: {
  readonly showCaret: boolean;
  readonly token: DashboardBorrowToken;
}) => (
  <>
    <TokenIcon token={token} />
    <Text className={styles.amountTokenButtonText} variant={{ weight: "bold" }}>
      {token.symbol}
    </Text>
    {showCaret ? (
      <Box className={styles.amountTokenButtonCaret}>
        <CaretDownIcon />
      </Box>
    ) : null}
  </>
);

export const StaticAmountTokenButton = ({
  token,
}: {
  readonly token: DashboardBorrowToken;
}) => {
  const variant = useWidgetConfig("variant");

  return (
    <Box
      className={clsx(
        styles.amountTokenButton,
        combineRecipeWithVariant({
          rec: selectTokenButton,
          variant,
        })
      )}
    >
      <AmountTokenButtonContent showCaret={false} token={token} />
    </Box>
  );
};

export const AmountTokenSelectTrigger = ({
  testId,
  token,
}: {
  readonly testId: string;
  readonly token: DashboardBorrowToken;
}) => {
  const variant = useWidgetConfig("variant");

  return (
    <Trigger asChild>
      <Box
        as="button"
        className={clsx(
          styles.amountTokenButton,
          styles.amountTokenButtonSelectable,
          pressAnimation,
          combineRecipeWithVariant({
            rec: selectTokenButton,
            variant,
          })
        )}
        data-testid={testId}
        type="button"
      >
        <AmountTokenButtonContent showCaret token={token} />
      </Box>
    </Trigger>
  );
};

export const BorrowAssetSelectorList = ({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) => (
  <Box className={styles.assetSelectorList} mx="4">
    <Text
      className={styles.assetSelectorSectionTitle}
      variant={{ weight: "bold" }}
    >
      {title}
    </Text>
    {children}
  </Box>
);

export const BorrowSelectorEmpty = ({
  children,
}: {
  readonly children: string;
}) => (
  <Box className={styles.assetSelectorEmpty}>
    <Text variant={{ type: "muted", weight: "normal" }}>{children}</Text>
  </Box>
);

export const BorrowAssetSelectorRow = ({
  expandable = false,
  expanded = false,
  indented = false,
  label,
  meta,
  onClick,
  rate,
  selected = false,
  testId,
  token,
}: {
  readonly expandable?: boolean;
  readonly expanded?: boolean;
  readonly indented?: boolean;
  readonly label: string;
  readonly meta?: string;
  readonly onClick: () => void;
  readonly rate?: string;
  readonly selected?: boolean;
  readonly testId?: string;
  readonly token: DashboardBorrowToken;
}) => (
  <Box
    as="button"
    className={clsx(
      styles.assetSelectorRow,
      indented && styles.assetSelectorMarketRow,
      selected && styles.assetSelectorRowSelected
    )}
    data-testid={testId}
    onClick={onClick}
    type="button"
  >
    {expandable ? (
      <Box
        className={clsx(
          styles.assetSelectorChevron,
          expanded && styles.assetSelectorChevronExpanded
        )}
      >
        <CaretDownIcon size={10} />
      </Box>
    ) : null}
    <TokenIcon token={token} />
    <Box className={styles.assetSelectorText}>
      <Text className={styles.assetSelectorLabel} variant={{ weight: "bold" }}>
        {label}
      </Text>
      {meta ? (
        <Text className={styles.assetSelectorMeta} variant={{ type: "muted" }}>
          {meta}
        </Text>
      ) : null}
    </Box>
    {rate ? (
      <Box className={styles.assetSelectorRate}>
        <Text variant={{ weight: "normal" }}>{rate}</Text>
      </Box>
    ) : null}
  </Box>
);
