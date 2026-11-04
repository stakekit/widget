import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FlowSteps } from "./flow-steps";

const stateLabels = {
  pending: "waiting",
  active: "in progress",
  signing: "Approve in your wallet",
  broadcasting: "Submitting to the network",
  done: "done",
  failed: "failed",
} as const;

const meta = {
  title: "Patterns/FlowSteps",
  component: FlowSteps,
  args: {
    label: "Transaction progress",
    stateLabels,
    explorerLink: {
      label: "View transaction",
      newTabLabel: "opens in a new tab",
    },
    retry: { label: "Try again", onClick: fn() },
    steps: [
      { id: "approve", label: "Approve", state: "done" },
      { id: "stake", label: "Stake", state: "signing" },
    ],
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <FlowSteps {...args} />
    </div>
  ),
} satisfies Meta<typeof FlowSteps>;
export default meta;

type Story = StoryObj<typeof meta>;

const stepItems = (canvasElement: HTMLElement) =>
  within(
    within(canvasElement).getByRole("list", { name: "Transaction progress" })
  ).getAllByRole("listitem");

/** Waiting its turn, a step reads as waiting and is not the current one. */
export const Pending: Story = {
  args: { steps: [{ id: "stake", label: "Stake", state: "pending" }] },
  play: async ({ canvasElement }) => {
    const [stake] = stepItems(canvasElement);
    await expect(stake).toHaveTextContent("Stake, waiting");
    await expect(stake).not.toHaveAttribute("aria-current");
  },
};

/** The current step, before the wallet is asked. */
export const Active: Story = {
  args: { steps: [{ id: "stake", label: "Stake", state: "active" }] },
  play: async ({ canvasElement }) => {
    const [stake] = stepItems(canvasElement);
    await expect(stake).toHaveAttribute("aria-current", "step");
    await expect(stake).toHaveTextContent("Stake, in progress");
  },
};

/** Waiting for the signature, the step says what to do. */
export const Signing: Story = {
  play: async ({ canvasElement }) => {
    const [, stake] = stepItems(canvasElement);
    await expect(stake).toHaveAttribute("aria-current", "step");
    await expect(stake).toHaveTextContent(
      "Stake, in progressApprove in your wallet"
    );
  },
};

export const SigningDark: Story = {
  ...Signing,
  globals: { colorScheme: "dark" },
};

/** Being sent to the network, the step says so. */
export const Broadcasting: Story = {
  args: {
    steps: [{ id: "stake", label: "Stake", state: "broadcasting" }],
  },
  play: async ({ canvasElement }) => {
    const [stake] = stepItems(canvasElement);
    await expect(stake).toHaveAttribute("aria-current", "step");
    await expect(stake).toHaveTextContent("Submitting to the network");
  },
};

/** Done, the step links to its transaction; no retry shows. */
export const Done: Story = {
  args: {
    steps: [
      {
        id: "stake",
        label: "Stake",
        state: "done",
        explorerUrl: "https://etherscan.io/tx/0x1",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [stake] = stepItems(canvasElement);
    await expect(stake).toHaveTextContent("Stake, done");
    await expect(
      canvas.getByRole("link", { name: "View transaction opens in a new tab" })
    ).toHaveAttribute("href", "https://etherscan.io/tx/0x1");
    await expect(
      canvas.queryByRole("button", { name: "Try again" })
    ).toBeNull();
  },
};

/** Failed, the step says what went wrong, and the retry button retries. */
export const Failed: Story = {
  args: {
    steps: [
      { id: "approve", label: "Approve", state: "done" },
      {
        id: "stake",
        label: "Stake",
        state: "failed",
        message: "The transaction was rejected.",
      },
    ],
  },
  play: async ({ args, canvasElement }) => {
    const [, stake] = stepItems(canvasElement);
    await expect(stake).toHaveTextContent(
      "Stake, failedThe transaction was rejected."
    );
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Try again" })
    );
    await expect(args.retry?.onClick).toHaveBeenCalledOnce();
  },
};

export const FailedDark: Story = {
  ...Failed,
  globals: { colorScheme: "dark" },
};

/** While the retry runs, its button is busy. */
export const Retrying: Story = {
  args: {
    ...Failed.args,
    retry: { label: "Try again", onClick: fn(), loading: true },
  },
  play: async ({ canvasElement }) => {
    const retry = within(canvasElement).getByRole("button", {
      name: "Try again",
    });
    await expect(retry).toBeDisabled();
    await expect(retry).toHaveAttribute("aria-busy", "true");
  },
};

/** Every state in one flow. */
export const AllStates: Story = {
  args: {
    steps: [
      { id: "1", label: "Approve", state: "done" },
      { id: "2", label: "Wrap", state: "failed", message: "Out of gas." },
      { id: "3", label: "Stake", state: "broadcasting" },
      { id: "4", label: "Delegate", state: "signing" },
      { id: "5", label: "Bridge", state: "active" },
      { id: "6", label: "Claim", state: "pending" },
    ],
  },
  play: async ({ canvasElement }) => {
    const steps = stepItems(canvasElement);
    await expect(steps.map((step) => step.textContent)).toEqual([
      "Approve, done",
      "Wrap, failedOut of gas.",
      "Stake, in progressSubmitting to the network",
      "Delegate, in progressApprove in your wallet",
      "Bridge, in progress",
      "Claim, waiting",
    ]);
  },
};
