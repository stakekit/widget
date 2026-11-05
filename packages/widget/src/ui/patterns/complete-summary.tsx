import * as stylex from "@stylexjs/stylex";
import { useEffect, useId, useState } from "react";
import { TokenAvatar } from "../components/avatar";
import { Card } from "../components/card";
import { DetailList, DetailRow } from "../components/detail-list";
import { Divider } from "../components/divider";
import { ExternalLink } from "../components/external-link";
import { Notice } from "../components/notice";
import { Icon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { keyframes } from "../tokens/keyframes.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { avatarSize } from "../tokens/size.stylex";
import type { TokenLogo } from "./token";

// The mark grows in as the summary appears.
const scaleIn = stylex.keyframes({
  from: { opacity: 0, transform: "scale(0.6)" },
  to: { opacity: 1, transform: "none" },
});

// Once the check has drawn, a success ring beats out from the mark and fades.
const successBeat = stylex.keyframes({
  from: { opacity: 0.6, transform: "scale(1)" },
  to: { opacity: 0, transform: "scale(1.45)" },
});

/**
 * The art over a completed action's title: the logo of the token the action
 * was about, else the provider's, with a success check badge; without
 * either, or when both fail to load, a plain check.
 */
type CompleteMark = {
  /** The token's symbol or name: the initial while a logo loads. */
  readonly name: string;
  /** The token's logo URL, such as the asset a deposit put in. */
  readonly tokenSrc?: string | undefined;
  /** The provider's logo URL, shown when the token's is missing or fails. */
  readonly providerSrc?: string | undefined;
};

/** One label-value row of what the action did, such as what it returned. */
type CompleteRow = {
  readonly label: string;
  /** The formatted value, such as "0.001 eETH". */
  readonly value: string;
  /** Context under the value, such as its fiat value. */
  readonly caption?: string;
  /** The value's text tone, such as `danger` for a figure at risk. */
  readonly tone?: "default" | "success" | "warning" | "danger";
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

/**
 * The position the action left, in a card under the title: what it now
 * holds and, for a deposit, what it is projected to earn.
 */
type CompletePosition = {
  /** Such as "Your position". */
  readonly heading: string;
  /** What it holds, such as "1.5 ETH"; unset while it is not yet known. */
  readonly value?: string;
  /** Under the value, such as its fiat value. */
  readonly caption?: string;
  /**
   * What it is projected to earn, such as a year's rewards with their fiat
   * value: read in the success tone.
   */
  readonly earnings?: Omit<CompleteRow, "tone">;
};

type CompleteSummaryProps = {
  /** What happened, such as "Successfully staked 0.5 ETH". */
  readonly title: string;
  readonly as?: "h1" | "h2" | "h3";
  /** The art over the title; unset, a plain check. */
  readonly mark?: CompleteMark;
  /** Under the title, such as "via Lido" or "Aave V3 · Ethereum". */
  readonly detail?: string;
  /**
   * Who ran the action, such as the chosen validator (`square`): its logo
   * leads the `detail` line, as on Review and Steps.
   */
  readonly provider?: TokenLogo;
  /** What the action did, such as what it returned and what it cost. */
  readonly rows?: ReadonlyArray<CompleteRow>;
  /**
   * The position the action left, in a card first under the title; shown
   * once it has a value or earnings.
   */
  readonly position?: CompletePosition;
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
 * The first of `srcs` that loads, as a hero avatar with a success badge,
 * else the plain check. Each source is probed in turn; one that fails to
 * load gives way to the next.
 */
const CompleteMarkArt = ({
  name,
  srcs,
}: {
  readonly name: string;
  readonly srcs: ReadonlyArray<string>;
}) => {
  const [failedCount, setFailedCount] = useState(0);
  const src = srcs[failedCount];

  useEffect(() => {
    if (src === undefined) return;
    const probe = new Image();
    probe.onerror = () => setFailedCount((count) => count + 1);
    probe.src = src;
    return () => {
      probe.onerror = null;
    };
  }, [src]);

  return src === undefined ? (
    <span {...stylex.props(styles.check)}>
      <span {...stylex.props(styles.drawCheck)}>
        <Icon name="CheckIcon" size="xl" />
      </span>
    </span>
  ) : (
    <TokenAvatar src={src} name={name} decorative size="hero" success />
  );
};

/** The position card: what the position holds, then what it should earn. */
const CompletePositionCard = ({
  position,
}: {
  readonly position: CompletePosition;
}) => (
  <Card padding={16} testId="complete-position">
    <Stack gap={12}>
      <Stack gap={4}>
        <Text variant="overline" tone="muted" as="p">
          {position.heading}
        </Text>
        {position.value !== undefined && (
          <Text variant="metric" as="p" breakAnywhere>
            {position.value}
          </Text>
        )}
        {position.caption !== undefined && (
          <Text as="p" variant="caption" tone="muted" numeric>
            {position.caption}
          </Text>
        )}
      </Stack>
      {position.earnings !== undefined && (
        <>
          {position.value !== undefined && <Divider />}
          <CompleteRows rows={[{ ...position.earnings, tone: "success" }]} />
        </>
      )}
    </Stack>
  </Card>
);

/**
 * The summary of a completed action: a success mark over what happened, the
 * position it left, what it did, what is left to do, and its transactions
 * as a compact list of explorer links. The hero is centred, the details
 * under it read from the start. The mark grows in, its check draws, and a
 * success ring beats out once, all at once under reduced motion.
 */
export const CompleteSummary = ({
  title,
  as = "h2",
  mark,
  detail,
  provider,
  rows = [],
  position,
  sections = [],
  note,
  transactions,
}: CompleteSummaryProps) => {
  const transactionsId = useId();
  // A provider logo that is the token's own adds nothing once that fails.
  const markSrcs = [
    ...(mark?.tokenSrc ? [mark.tokenSrc] : []),
    ...(mark?.providerSrc && mark.providerSrc !== mark.tokenSrc
      ? [mark.providerSrc]
      : []),
  ];
  const shownPosition =
    position?.value !== undefined || position?.earnings !== undefined
      ? position
      : undefined;

  return (
    <Stack gap={20}>
      <Stack align="center" gap={8}>
        <span
          aria-hidden="true"
          data-testid="complete-mark"
          {...stylex.props(styles.mark)}
        >
          <span
            data-testid="complete-mark-beat"
            {...stylex.props(styles.beat)}
          />
          <CompleteMarkArt
            // New sources start the probe over from the first.
            key={markSrcs.join(" ")}
            name={mark?.name ?? ""}
            srcs={markSrcs}
          />
        </span>
        <Text variant="title" as={as} align="center" breakAnywhere>
          {title}
        </Text>
        {detail !== undefined && (
          <Stack direction="row" align="center" justify="center" gap={6}>
            {provider !== undefined && (
              <TokenAvatar {...provider} size="sm" decorative />
            )}
            <Text as="p" tone="muted" align="center">
              {detail}
            </Text>
          </Stack>
        )}
      </Stack>

      {shownPosition !== undefined && (
        <CompletePositionCard position={shownPosition} />
      )}

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
  mark: {
    animationDuration: motion.slow,
    animationFillMode: "both",
    animationName: scaleIn,
    animationTimingFunction: motion.easing,
    display: "inline-flex",
    position: "relative",
  },
  // A success ring beats out once the check has drawn, then fades away;
  // under reduced motion it ends at once, never seen.
  beat: {
    inset: 0,
    borderColor: color.success,
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.medium,
    // oxlint-disable-next-line design-system/no-raw-design-value -- the sum of two motion tokens: the beat starts once the check has drawn.
    animationDelay: `calc(${motion.base} + ${motion.slow})`,
    animationDuration: motion.slow,
    animationFillMode: "both",
    animationName: successBeat,
    animationTimingFunction: motion.easing,
    boxSizing: "border-box",
    pointerEvents: "none",
    position: "absolute",
  },
  // The success tint behind a success-colored check, never white on a fill.
  check: {
    borderRadius: radius.pill,
    alignItems: "center",
    backgroundColor: color.successSoft,
    color: color.success,
    display: "inline-flex",
    flexShrink: 0,
    justifyContent: "center",
    height: avatarSize.hero,
    width: avatarSize.hero,
  },
  // The check draws once the mark has grown most of the way in.
  drawCheck: {
    animationDelay: motion.base,
    animationDuration: motion.slow,
    animationFillMode: "both",
    animationName: keyframes.drawIn,
    animationTimingFunction: motion.easing,
    display: "flex",
  },
});
