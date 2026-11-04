import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Steps } from "./steps";

const meta = {
  title: "Components/Steps",
  component: Steps,
  args: {
    label: "Transaction progress",
    statusLabels: {
      idle: "waiting",
      active: "in progress",
      failed: "failed",
      done: "done",
    },
    steps: [
      { id: "sign", label: "Approve in your wallet", status: "done" },
      {
        id: "submit",
        label: "Submitting",
        description: "Sending the transaction to the network.",
        status: "active",
      },
      { id: "confirm", label: "Confirming", status: "idle" },
    ],
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <Steps {...args} />
    </div>
  ),
} satisfies Meta<typeof Steps>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Each step reads its status; the active step is the current one. */
export const InProgress: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list", {
      name: "Transaction progress",
    });
    const [sign, submit, confirm] = within(list).getAllByRole("listitem");

    await expect(sign).toHaveTextContent("Approve in your wallet, done");
    await expect(submit).toHaveAttribute("aria-current", "step");
    await expect(submit).toHaveTextContent("Submitting, in progress");
    await expect(confirm).toHaveTextContent("Confirming, waiting");
    await expect(confirm).not.toHaveAttribute("aria-current");
  },
};

export const InProgressDark: Story = {
  ...InProgress,
  globals: { colorScheme: "dark" },
};

export const Failed: Story = {
  args: {
    steps: [
      { id: "sign", label: "Approve in your wallet", status: "done" },
      {
        id: "submit",
        label: "Submitting",
        description: "Something went wrong.",
        status: "failed",
      },
      { id: "confirm", label: "Confirming", status: "idle" },
    ],
  },
  play: async ({ canvasElement }) => {
    const [, submit] = within(canvasElement).getAllByRole("listitem");
    await expect(submit).toHaveTextContent("Submitting, failed");
  },
};
