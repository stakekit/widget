import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
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

/** A step can link out, such as to its transaction on a block explorer. */
export const WithLink: Story = {
  args: {
    steps: [
      {
        id: "sign",
        label: "Approve in your wallet",
        status: "done",
        link: {
          href: "https://etherscan.io/tx/0x1",
          label: "View transaction",
          newTabLabel: "opens in a new tab",
        },
      },
      { id: "confirm", label: "Confirming", status: "active" },
    ],
  },
  play: async ({ canvasElement }) => {
    const [sign] = within(canvasElement).getAllByRole("listitem");
    await expect(
      within(sign ?? canvasElement).getByRole("link", {
        name: "View transaction opens in a new tab",
      })
    ).toHaveAttribute("href", "https://etherscan.io/tx/0x1");
  },
};

const hashAndActionSteps: ComponentProps<typeof Steps>["steps"] = [
  {
    id: "approve",
    label: "Approve",
    status: "done",
    state: "Confirmed",
    link: {
      href: "https://etherscan.io/tx/0x1",
      label: "0x1234…abcd",
      context: "View transaction",
      newTabLabel: "opens in a new tab",
    },
  },
  {
    id: "stake",
    label: "Stake",
    status: "failed",
    description: "The transaction was rejected.",
    action: { label: "Try again", onClick: fn() },
  },
];

/**
 * A step's own state line replaces its status's label; a shortened hash link
 * reads what it opens first, and the step's button acts.
 */
export const WithStateHashAndAction: Story = {
  args: {
    steps: hashAndActionSteps,
  },
  play: async ({ args, canvasElement }) => {
    const [approve, stake] = within(canvasElement).getAllByRole("listitem");
    await expect(approve).toHaveTextContent("Approve, Confirmed");
    await expect(
      within(approve ?? canvasElement).getByRole("link", {
        name: "View transaction, 0x1234…abcd opens in a new tab",
      })
    ).toHaveAttribute("href", "https://etherscan.io/tx/0x1");
    await expect(stake).toHaveTextContent(
      "Stake, failedThe transaction was rejected."
    );
    await userEvent.click(
      within(stake ?? canvasElement).getByRole("button", { name: "Try again" })
    );
    await expect(args.steps[1]?.action?.onClick).toHaveBeenCalledOnce();
  },
};

export const WithStateHashAndActionDark: Story = {
  ...WithStateHashAndAction,
  globals: { colorScheme: "dark" },
};

const box = (element: Element | undefined) => {
  if (element === undefined) throw new Error("Expected an element.");
  return element.getBoundingClientRect();
};

/**
 * Markers are 28px circles; each connector runs from its marker to the next
 * one; steps sit 20px apart; nothing leaves the list at a narrow width.
 */
export const Geometry: Story = {
  args: { steps: hashAndActionSteps },
  render: (args) => (
    <div style={{ width: 200 }}>
      <Steps {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list");
    const [first, second] = within(list).getAllByRole("listitem");
    const [connector, marker, text] = Array.from(first?.children ?? []);
    const nextMarker = second?.children[0];

    await expect(box(marker).width).toBe(28);
    await expect(box(marker).height).toBe(28);
    await expect(box(connector).top).toBe(box(marker).bottom);
    await expect(box(connector).bottom).toBe(box(nextMarker).top);
    await expect(box(second).top - box(text).bottom).toBe(20);

    const listBox = list.getBoundingClientRect();
    for (const element of list.querySelectorAll("*")) {
      const { left, right } = element.getBoundingClientRect();
      await expect(left).toBeGreaterThanOrEqual(listBox.left);
      await expect(right).toBeLessThanOrEqual(listBox.right);
    }
  },
};
