import { IconAvatar, TokenAvatar } from "../components/avatar";
import { Card } from "../components/card";
import { DetailList, DetailRow } from "../components/detail-list";
import { Steps } from "../components/steps";
import { Icon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import type { TokenLogo } from "./token";

/**
 * Where a transaction of a flow stands: waiting its turn, the current one,
 * waiting for the wallet's signature, being sent to the network, done, or
 * failed.
 */
type FlowStepState =
  | "pending"
  | "active"
  | "signing"
  | "broadcasting"
  | "done"
  | "failed";

/** One transaction of a flow. */
type FlowStep = {
  /** Unique within the flow. */
  readonly id: string;
  /** What the transaction does, such as "Approve" or "Stake". */
  readonly label: string;
  readonly state: FlowStepState;
  /** Shown under the state, such as how long it takes or what went wrong. */
  readonly message?: string;
  /** The transaction on a block explorer, once it has one. */
  readonly explorerUrl?: string;
  /**
   * The transaction's hash as its explorer link shows it, such as
   * shortened. Unset, the link shows the explorer link's label.
   */
  readonly hash?: string;
};

type FlowStepsProps = {
  readonly steps: ReadonlyArray<FlowStep>;
  /** Names the list, such as "Transaction progress". */
  readonly label: string;
  /** What each state is called, on the line under a step's label. */
  readonly stateLabels: Readonly<Record<FlowStepState, string>>;
  /** The action the flow runs, above its steps. */
  readonly summary?: {
    /** Such as "Stake 0.01 ETH". */
    readonly title: string;
    /** Under the title, such as "via Lido". */
    readonly detail?: string;
    readonly token?: TokenLogo;
  };
  /**
   * How far the flow got, such as "1 of 2 confirmed": shown once the flow
   * runs more than one step.
   */
  readonly progressLabel?: (progress: {
    readonly confirmed: number;
    readonly total: number;
  }) => string;
  /** Names the explorer link and its new-tab icon. */
  readonly explorerLink?: {
    readonly label: string;
    readonly newTabLabel: string;
  };
  /**
   * Asks the user to check their wallet, in a card under the steps: given
   * while a step waits for its signature.
   */
  readonly signaturePrompt?: {
    /** Such as "Check your wallet". */
    readonly title: string;
    /** Such as "Approve the Stake transaction in MetaMask". */
    readonly description: string;
    /** The wallet asked; unset or without a logo, a wallet icon shows. */
    readonly wallet?: {
      readonly name: string;
      readonly logo?: string;
    };
  };
  /**
   * What the flow runs, as its Review showed it, in a card under the steps:
   * such as the amount, where it goes, and the estimated gas.
   */
  readonly details?: ReadonlyArray<FlowStepsDetail>;
};

/** One label-value row of a flow's details. */
type FlowStepsDetail = {
  readonly label: string;
  readonly value: string;
  /** Under the value, such as its fiat value. */
  readonly caption?: string;
  /** Renders as the row's `data-testid`. */
  readonly testId?: string;
};

const stepStatus = {
  pending: "idle",
  active: "active",
  signing: "signing",
  broadcasting: "active",
  done: "done",
  failed: "failed",
} as const satisfies Record<FlowStepState, string>;

// Being sent fills a third of the way to the next step; confirming, two.
const stepStage = {
  broadcasting: "submitting",
  active: "confirming",
} as const satisfies Partial<Record<FlowStepState, string>>;

/**
 * A flow's transactions as a `Steps` timeline under a summary of the action
 * they run: how many are done, each transaction's state under its label, and
 * its explorer link once it has one. Under the steps, a card asks to check
 * the wallet while it is given, and another lists the flow's details.
 */
export const FlowSteps = ({
  steps,
  label,
  stateLabels,
  summary,
  progressLabel,
  explorerLink,
  signaturePrompt,
  details = [],
}: FlowStepsProps) => {
  const confirmed = steps.filter((step) => step.state === "done").length;

  return (
    <Stack gap={16}>
      {summary !== undefined && (
        <Stack direction="row" align="center" gap={12}>
          {summary.token !== undefined && (
            <TokenAvatar {...summary.token} size="md" decorative />
          )}
          <Stack gap={2} grow>
            <Text weight="semibold" breakAnywhere>
              {summary.title}
            </Text>
            {summary.detail !== undefined && (
              <Text variant="caption" tone="muted">
                {summary.detail}
              </Text>
            )}
          </Stack>
        </Stack>
      )}
      {progressLabel !== undefined && steps.length > 1 && (
        <Text variant="caption" tone="muted" numeric>
          {progressLabel({ confirmed, total: steps.length })}
        </Text>
      )}
      {steps.length > 0 && (
        <Steps
          label={label}
          statusLabels={{
            idle: stateLabels.pending,
            active: stateLabels.active,
            signing: stateLabels.signing,
            done: stateLabels.done,
            failed: stateLabels.failed,
          }}
          steps={steps.map((step) => ({
            id: step.id,
            label: step.label,
            status: stepStatus[step.state],
            state: stateLabels[step.state],
            ...(step.state === "broadcasting" || step.state === "active"
              ? { stage: stepStage[step.state] }
              : {}),
            ...(step.message === undefined
              ? {}
              : { description: step.message }),
            ...(step.explorerUrl === undefined || explorerLink === undefined
              ? {}
              : {
                  link: {
                    href: step.explorerUrl,
                    newTabLabel: explorerLink.newTabLabel,
                    ...(step.hash === undefined
                      ? { label: explorerLink.label }
                      : { context: explorerLink.label, label: step.hash }),
                  },
                }),
          }))}
        />
      )}
      {signaturePrompt !== undefined && (
        <Card testId="flow-steps-signature-prompt">
          <Stack direction="row" align="center" gap={12}>
            {signaturePrompt.wallet?.logo === undefined ? (
              <IconAvatar size="card">
                <Icon name="WalletIcon" size="md" />
              </IconAvatar>
            ) : (
              <TokenAvatar
                src={signaturePrompt.wallet.logo}
                name={signaturePrompt.wallet.name}
                shape="square"
                size="card"
                decorative
              />
            )}
            <Stack gap={2} grow>
              <Text weight="semibold">{signaturePrompt.title}</Text>
              <Text variant="caption" tone="muted" breakAnywhere>
                {signaturePrompt.description}
              </Text>
            </Stack>
          </Stack>
        </Card>
      )}
      {details.length > 0 && (
        <Card testId="flow-steps-details">
          <DetailList>
            {details.map((detail) => (
              <DetailRow
                key={detail.label}
                label={detail.label}
                value={detail.value}
                {...(detail.caption === undefined
                  ? {}
                  : { caption: detail.caption })}
                {...(detail.testId === undefined
                  ? {}
                  : { testId: detail.testId })}
              />
            ))}
          </DetailList>
        </Card>
      )}
    </Stack>
  );
};
