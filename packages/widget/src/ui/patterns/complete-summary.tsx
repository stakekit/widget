import * as stylex from "@stylexjs/stylex";
import { useId } from "react";
import { Card } from "../components/card";
import { DetailList, DetailRow } from "../components/detail-list";
import { ExternalLink } from "../components/external-link";
import { Notice } from "../components/notice";
import { Icon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { avatarSize } from "../tokens/size.stylex";

/** One label-value row of what the action did, such as what it returned. */
type CompleteRow = {
  readonly label: string;
  /** The formatted value, such as "0.001 eETH". */
  readonly value: string;
  /** Context under the value, such as its fiat value. */
  readonly caption?: string;
  /** The value's text tone, such as `danger` for a figure at risk. */
  readonly tone?: "default" | "warning" | "danger";
  /** Renders as the row's `data-testid`. */
  readonly testId?: string;
};

/** One sent transaction, linked on its block explorer. */
type CompleteTransaction = {
  /** Unique within the action. */
  readonly id: string;
  /** What the transaction did, such as "Approve" or "Stake". */
  readonly label: string;
  readonly href: string;
  /** The hash as the link shows it, such as shortened; unset, `viewLabel` shows. */
  readonly hash?: string;
  /** Names the link, such as "View Stake transaction". */
  readonly viewLabel: string;
};

type CompleteSummaryProps = {
  /** What happened, such as "Successfully staked 0.5 ETH". */
  readonly title: string;
  /** The heading level the page's outline needs. */
  readonly as?: "h1" | "h2" | "h3";
  /** Under the title, such as "via Lido" or "Aave V3 · Ethereum". */
  readonly detail?: string;
  /** What the action did, such as what it returned and what it cost. */
  readonly rows?: ReadonlyArray<CompleteRow>;
  /** Further rows under an overline, such as the position it left. */
  readonly sections?: ReadonlyArray<{
    readonly heading: string;
    readonly rows: ReadonlyArray<CompleteRow>;
  }>;
  /**
   * What the user still has to do, such as withdrawing unstaked funds once
   * they unlock.
   */
  readonly note?: string;
  readonly transactions?: {
    /** Names the list, such as "Transactions". */
    readonly heading: string;
    /** Names each link's new-tab icon. */
    readonly newTabLabel: string;
    readonly items: ReadonlyArray<CompleteTransaction>;
    /** Called as a transaction's link opens, such as to record the visit. */
    readonly onOpen?: () => void;
  };
};

const CompleteRows = ({
  rows,
}: {
  readonly rows: ReadonlyArray<CompleteRow>;
}) => (
  <DetailList>
    {rows.map((row) => (
      <DetailRow
        key={row.label}
        label={row.label}
        value={row.value}
        {...(row.caption === undefined ? {} : { caption: row.caption })}
        {...(row.tone === undefined ? {} : { tone: row.tone })}
        {...(row.testId === undefined ? {} : { testId: row.testId })}
      />
    ))}
  </DetailList>
);

/**
 * The summary of a completed action: a success mark over what happened,
 * what it did, what is left to do, and its transactions as a compact list
 * of explorer links.
 */
export const CompleteSummary = ({
  title,
  as = "h2",
  detail,
  rows = [],
  sections = [],
  note,
  transactions,
}: CompleteSummaryProps) => {
  const transactionsId = useId();

  return (
    <Stack gap={20}>
      <Stack align="center" gap={8}>
        <span aria-hidden="true" {...stylex.props(styles.mark)}>
          <Icon name="CheckIcon" size="lg" />
        </span>
        <Text variant="title" as={as} align="center" breakAnywhere>
          {title}
        </Text>
        {detail !== undefined && (
          <Text as="p" tone="muted" align="center">
            {detail}
          </Text>
        )}
      </Stack>

      {rows.length > 0 && <CompleteRows rows={rows} />}

      {sections
        .filter((section) => section.rows.length > 0)
        .map((section) => (
          <Stack key={section.heading} gap={8}>
            <Text variant="overline" tone="muted" as="p">
              {section.heading}
            </Text>
            <CompleteRows rows={section.rows} />
          </Stack>
        ))}

      {note !== undefined && <Notice tone="info">{note}</Notice>}

      {transactions !== undefined && transactions.items.length > 0 && (
        <Card padding={16}>
          <Stack gap={12}>
            <Text variant="overline" tone="muted" as="p" id={transactionsId}>
              {transactions.heading}
            </Text>
            <Stack as="ul" gap={12} aria-labelledby={transactionsId}>
              {transactions.items.map((transaction) => (
                <Stack
                  key={transaction.id}
                  as="li"
                  direction="row"
                  align="center"
                  justify="between"
                  gap={12}
                >
                  <Stack direction="row" align="center" gap={8}>
                    <Icon name="CheckCircleIcon" size="sm" tone="success" />
                    <Text>{transaction.label}</Text>
                  </Stack>
                  <Text variant="caption" numeric>
                    <ExternalLink
                      href={transaction.href}
                      newTabLabel={transactions.newTabLabel}
                      {...(transactions.onOpen === undefined
                        ? {}
                        : { onClick: transactions.onOpen })}
                    >
                      {transaction.hash === undefined ? (
                        transaction.viewLabel
                      ) : (
                        <>
                          <VisuallyHidden>{`${transaction.viewLabel}, `}</VisuallyHidden>
                          {transaction.hash}
                        </>
                      )}
                    </ExternalLink>
                  </Text>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Card>
      )}
    </Stack>
  );
};

const styles = stylex.create({
  // The success tint behind a success-colored check, never white on a fill.
  mark: {
    borderRadius: radius.pill,
    alignItems: "center",
    backgroundColor: color.successSoft,
    color: color.success,
    display: "inline-flex",
    flexShrink: 0,
    justifyContent: "center",
    height: avatarSize.lg,
    width: avatarSize.lg,
  },
});
