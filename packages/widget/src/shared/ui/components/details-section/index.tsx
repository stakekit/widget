import type { ReactNode } from "react";
import { formatAddress } from "../../../lib/general";
import { Box } from "../../primitives/box";
import * as CopyText from "../../primitives/copy-text";
import { Text } from "../../primitives/typography/text";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "../collapsible";
import * as styles from "./styles.css";

type DetailRowProps = Readonly<{
  readonly id?: string;
  readonly label: string;
  readonly value: ReactNode;
}>;

type AddressRowProps = Readonly<{
  readonly address: string;
  readonly label: string;
}>;

export const DetailsSection = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => (
  <CollapsibleRoot initial={false}>
    <Box display="flex" flexDirection="column">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        paddingBottom="3"
      >
        <Text variant={{ weight: "bold" }}>{title}</Text>
        <CollapsibleTrigger flex={1} justifyContent="flex-end">
          <CollapsibleArrow />
        </CollapsibleTrigger>
      </Box>

      <CollapsibleContent>{children}</CollapsibleContent>
    </Box>
  </CollapsibleRoot>
);

export const DetailRow = ({ label, value }: DetailRowProps) => (
  <Box className={styles.detailRow}>
    <Text
      as="span"
      className={styles.detailRowLabel}
      variant={{ type: "muted", weight: "normal" }}
    >
      {label}
    </Text>
    {typeof value === "string" ? (
      <Text
        as="span"
        className={styles.valueText}
        variant={{ weight: "normal" }}
      >
        {value}
      </Text>
    ) : (
      <Box className={styles.valueText}>{value}</Box>
    )}
  </Box>
);

export const AddressRow = ({ address, label }: AddressRowProps) => (
  <Box className={styles.addressBox}>
    <Text
      as="span"
      className={styles.detailRowLabel}
      variant={{ type: "muted", weight: "normal" }}
    >
      {label}
    </Text>
    <CopyText.Provider text={address}>
      <CopyText.Root>
        <Box className={styles.addressValue}>
          <Text
            as="span"
            className={styles.valueText}
            variant={{ weight: "normal" }}
          >
            {formatAddress(address)}
          </Text>
          <CopyText.AnimatedContent>
            <Box display="flex" alignItems="center" justifyContent="center">
              <CopyText.Icons hw={14} />
            </Box>
          </CopyText.AnimatedContent>
        </Box>
      </CopyText.Root>
    </CopyText.Provider>
  </Box>
);
