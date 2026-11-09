import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ErrorState } from "./error-state";

const meta = {
  title: "Patterns/ErrorState",
  component: ErrorState,
  args: {
    title: "Something went wrong",
    body: "We could not load the yields. Check your connection and try again.",
    action: { label: "Try again", onClick: fn() },
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <ErrorState {...args} />
    </div>
  ),
} satisfies Meta<typeof ErrorState>;
export default meta;

type Story = StoryObj<typeof meta>;

/** It is announced as an alert, and its action retries. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("Something went wrong");
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(args.action?.onClick).toHaveBeenCalledOnce();
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/** While the retry runs, its button is busy. */
export const Retrying: Story = {
  args: { action: { label: "Try again", onClick: fn(), loading: true } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Try again" })
    ).toBeDisabled();
  },
};

/** Without an action, as when nothing the user does can fix it. */
export const WithoutAction: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <ErrorState
        title="Unavailable in your region"
        body="This yield is not offered where you are."
      />
    </div>
  ),
};
