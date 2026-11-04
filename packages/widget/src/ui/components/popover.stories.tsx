import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import { Popover } from "./popover";

const meta = {
  title: "Components/Popover",
  component: Popover,
  args: {
    trigger: <Button>Fees</Button>,
    title: "Network fees",
    children: "Paid to the network to process the transaction.",
  },
  render: (args) => (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <Popover {...args} />
    </div>
  ),
} satisfies Meta<typeof Popover>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A click opens the popover, named by its title. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Fees" });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Network fees" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  },
};

export const Dark: Story = { ...Default, globals: { colorScheme: "dark" } };

/**
 * Enter opens it and moves focus to the popup, which shows the focus ring;
 * Escape closes it and focus returns to the trigger.
 */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Fees" });

    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", { name: "Network fees" });
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(dialog).toHaveFocus());
    await expect(getComputedStyle(dialog).outlineStyle).toBe("solid");

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  },
};

/** A disabled trigger opens nothing. */
export const DisabledTrigger: Story = {
  args: { trigger: <Button disabled>Fees</Button> },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Fees" });
    await expect(trigger).toBeDisabled();
    await userEvent.click(trigger, { pointerEventsCheck: 0 });
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
};
