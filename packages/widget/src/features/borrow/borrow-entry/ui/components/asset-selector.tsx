import clsx from "clsx";
import type { ReactNode } from "react";
import { TokenIcon } from "../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../shared/ui/primitives/box";
import { CaretDownIcon } from "../../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import type { BorrowEntryToken } from "../../model/market-groups";
import * as styles from "../styles.css";

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
  readonly token: BorrowEntryToken;
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
