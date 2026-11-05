import { TokenAvatar } from "../components/avatar";
import { Button } from "../components/button";
import { Steps } from "../components/steps";
import type { HostHook } from "../host-hook";
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
   * The retry button, shown once a step failed: under that step, or under
   * the list when no step shows the failure.
   */
  readonly retry?: {
    readonly label: string;
    readonly onClick: () => void;
    readonly loading?: boolean;
    readonly hostHook?: HostHook;
  };
};

const stepStatus = {
  pending: "idle",
  active: "active",
  signing: "active",
  broadcasting: "active",
  done: "done",
  failed: "failed",
} as const satisfies Record<FlowStepState, string>;

/**
 * A flow's transactions as a `Steps` timeline under a summary of the action
 * they run: how many are done, each transaction's state under its label, its
 * explorer link once it has one, and a retry button once a transaction
 * failed.
 */
export const FlowSteps = ({
  steps,
  label,
  stateLabels,
  summary,
  progressLabel,
  explorerLink,
  retry,
}: FlowStepsProps) => {
  const failedId = steps.find((step) => step.state === "failed")?.id;
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
            done: stateLabels.done,
            failed: stateLabels.failed,
          }}
          steps={steps.map((step) => ({
            id: step.id,
            label: step.label,
            status: stepStatus[step.state],
            state: stateLabels[step.state],
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
            ...(retry !== undefined && step.id === failedId
              ? { action: retry }
              : {}),
          }))}
        />
      )}
      {retry !== undefined && failedId === undefined && (
        <Button
          variant="primary"
          size="cta"
          onClick={retry.onClick}
          loading={retry.loading ?? false}
          {...(retry.hostHook === undefined
            ? {}
            : { hostHook: retry.hostHook })}
        >
          {retry.label}
        </Button>
      )}
    </Stack>
  );
};
