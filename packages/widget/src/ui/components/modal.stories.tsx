import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { Text } from "../primitives/text";
import { Button } from "./button";
import { Modal } from "./modal";

const meta = {
  title: "Components/Modal",
  component: Modal,
  args: {
    title: "What is Yield.xyz?",
    description: "Yield.xyz connects you to staking and lending yields.",
    closeLabel: "Close",
    trigger: <Button variant="primary">Learn more</Button>,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Modal>;
export default meta;

type Story = StoryObj<typeof meta>;

const dialog = () =>
  screen.findByRole("dialog", { name: "What is Yield.xyz?" });

/** Opens from its trigger; the close button closes it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Learn more" })
    );
    const popup = await dialog();
    await waitFor(() => expect(popup).toBeVisible());
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/** Footer actions sit under the body. */
export const WithFooter: Story = {
  ...Default,
  args: {
    children: <Text tone="muted">Read the documentation to learn more.</Text>,
    footer: (
      <Button variant="primary" size="cta">
        Got it
      </Button>
    ),
  },
};

/** A bottom sheet below a 520px viewport. */
export const Sheet: Story = {
  ...WithFooter,
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

/**
 * Enter opens it from the keyboard; focus moves inside and stays there on Tab;
 * Escape closes it and returns focus to the trigger.
 */
export const KeyboardOpenClose: Story = {
  args: {
    footer: <Button variant="primary">Got it</Button>,
  },
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Learn more",
    });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    const popup = await dialog();
    await waitFor(() =>
      expect(popup.contains(document.activeElement)).toBe(true)
    );

    for (let presses = 0; presses < 4; presses++) {
      await userEvent.tab();
      await waitFor(() =>
        expect(popup.contains(document.activeElement)).toBe(true)
      );
    }

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(trigger).toHaveFocus();
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

/** The close button closes it and returns focus to the trigger. */
export const CloseButton: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Learn more",
    });
    await userEvent.click(trigger);
    const popup = await dialog();

    await userEvent.click(within(popup).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};

const ControlledModal = () => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Reopen</Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Geo Block"
        closeLabel="Close"
        description="This feature is not available in your region."
      />
    </>
  );
};

/** Controlled and open on mount, as a notice the Widget shows itself. */
export const Controlled: Story = {
  render: () => <ControlledModal />,
  play: async () => {
    const popup = await screen.findByRole("dialog", { name: "Geo Block" });
    await waitFor(() => expect(popup).toBeVisible());
    await expect(popup).toHaveAccessibleDescription(
      "This feature is not available in your region."
    );

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

/** The popup renders into the portal container inside the theme root. */
export const InsideThemeRoot: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Learn more" })
    );
    const popup = await dialog();
    await expect(popup.closest("[data-sk-root]")).not.toBeNull();
    await expect(popup.closest("[data-sk-portal]")).not.toBeNull();
  },
};
