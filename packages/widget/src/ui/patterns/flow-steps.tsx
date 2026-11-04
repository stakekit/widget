import { Button } from "../components/button";
import { Steps } from "../components/steps";
import { Stack } from "../primitives/stack";

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
  /**
   * Shown under the label in place of the state's own text, such as what
   * went wrong.
   */
  readonly message?: string;
  /** The transaction on a block explorer, once it has one. */
  readonly explorerUrl?: string;
};

type FlowStepsProps = {
  readonly steps: ReadonlyArray<FlowStep>;
  /** Names the list, such as "Transaction progress". */
  readonly label: string;
  /**
   * What each state is called. Assistive technology reads it after a step's
   * label; the signing, broadcasting and failed ones also show under it.
   */
  readonly stateLabels: Readonly<Record<FlowStepState, string>>;
  /** Names the explorer link and its new-tab icon. */
  readonly explorerLink?: {
    readonly label: string;
    readonly newTabLabel: string;
  };
  /** The retry button, shown once a step failed. */
  readonly retry?: {
    readonly label: string;
    readonly onClick: () => void;
    readonly loading?: boolean;
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

/** Whether a state's own text shows under the label. */
const describedStates = {
  pending: false,
  active: false,
  signing: true,
  broadcasting: true,
  done: false,
  failed: true,
} as const satisfies Record<FlowStepState, boolean>;

/**
 * A flow's transactions as a `Steps` timeline: each transaction's state as a
 * step status, its explorer link once it has one, and a retry button once a
 * transaction failed.
 */
export const FlowSteps = ({
  steps,
  label,
  stateLabels,
  explorerLink,
  retry,
}: FlowStepsProps) => (
  <Stack gap={16}>
    <Steps
      label={label}
      statusLabels={{
        idle: stateLabels.pending,
        active: stateLabels.active,
        done: stateLabels.done,
        failed: stateLabels.failed,
      }}
      steps={steps.map((step) => {
        const description =
          step.message ??
          (describedStates[step.state] ? stateLabels[step.state] : undefined);

        return {
          id: step.id,
          label: step.label,
          status: stepStatus[step.state],
          ...(description === undefined ? {} : { description }),
          ...(step.explorerUrl === undefined || explorerLink === undefined
            ? {}
            : { link: { href: step.explorerUrl, ...explorerLink } }),
        };
      })}
    />
    {retry !== undefined && steps.some((step) => step.state === "failed") && (
      <Button
        variant="primary"
        size="cta"
        onClick={retry.onClick}
        loading={retry.loading ?? false}
      >
        {retry.label}
      </Button>
    )}
  </Stack>
);
