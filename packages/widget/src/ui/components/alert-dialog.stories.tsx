import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { AlertDialog } from "./alert-dialog";
import { Button } from "./button";

const meta = {
  title: "Components/AlertDialog",
  component: AlertDialog,
  args: {
    trigger: <Button>Leave</Button>,
    title: "Leave this flow?",
    description: "The transactions you have not signed will be dropped.",
    confirmLabel: "Leave",
    cancelLabel: "Stay",
    onConfirm: fn(),
    onCancel: fn(),
    onOpenChange: fn(),
    testId: "alert-dialog",
    tone: "danger",
  },
} satisfies Meta<typeof AlertDialog>;
export default meta;

type Story = StoryObj<typeof meta>;

const openDialog = async (canvasElement: HTMLElement) => {
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: "Leave" })
  );
  return screen.findByRole("alertdialog", { name: "Leave this flow?" });
};

/** The dialog is an `alertdialog`, named by its question. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await expect(dialog).toHaveAccessibleDescription(
      "The transactions you have not signed will be dropped."
    );
    await expect(dialog).toHaveAttribute("data-testid", "alert-dialog");
  },
};

export const OpenDark: Story = { ...Open, globals: { colorScheme: "dark" } };

export const OpenPrimary: Story = { ...Open, args: { tone: "primary" } };

/**
 * Confirming runs the action, closes the dialog without cancelling and
 * returns focus.
 */
export const Confirm: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Leave" })
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(args.onCancel).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(
      within(canvasElement).getByRole("button", { name: "Leave" })
    ).toHaveFocus();
  },
};

/** Cancel closes the dialog without confirming and returns focus. */
export const Cancel: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = await openDialog(canvasElement);
    await userEvent.click(within(dialog).getByRole("button", { name: "Stay" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await expect(
      within(canvasElement).getByRole("button", { name: "Leave" })
    ).toHaveFocus();
  },
};

/**
 * Focus starts on cancel and stays trapped: Tab past the last action wraps to
 * the first, Shift+Tab past the first wraps to the last. A press on the
 * backdrop keeps it open; Escape closes it without confirming and focus
 * returns to the trigger.
 */
export const Keyboard: Story = {
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Leave",
    });
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const dialog = await screen.findByRole("alertdialog");
    const stay = within(dialog).getByRole("button", { name: "Stay" });
    const leave = within(dialog).getByRole("button", { name: "Leave" });

    await waitFor(() => expect(stay).toHaveFocus());
    await userEvent.tab();
    await expect(leave).toHaveFocus();
    await userEvent.tab();
    await waitFor(() => expect(stay).toHaveFocus());
    await userEvent.tab({ shift: true });
    await waitFor(() => expect(leave).toHaveFocus());

    // The element a press in the corner lands on is the backdrop.
    const backdrop = document.elementFromPoint(2, 2);
    await expect(backdrop).toHaveAttribute("role", "presentation");
    await expect(dialog.contains(backdrop)).toBe(false);
    if (backdrop) await userEvent.click(backdrop);
    const frame = Promise.withResolvers<void>();
    requestAnimationFrame(() => frame.resolve());
    await frame.promise;
    await expect(args.onOpenChange).not.toHaveBeenCalledWith(false);
    await expect(dialog).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(trigger).toHaveFocus();
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
  },
};
