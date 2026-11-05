import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { EmptyState } from "./empty-state";

const meta = {
  title: "Patterns/EmptyState",
  component: EmptyState,
  args: {
    title: "No positions yet",
    body: "Stake a token to see your positions here.",
    action: { label: "Start earning", onClick: fn() },
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <EmptyState {...args} />
    </div>
  ),
} satisfies Meta<typeof EmptyState>;
export default meta;

type Story = StoryObj<typeof meta>;

/** An icon, a title, a body and the action that fills the space. */
export const Default: Story = {
  args: { icon: "HistoryIcon" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 3, name: "No positions yet" })
    ).toBeVisible();
    await expect(
      canvas.getByText("Stake a token to see your positions here.")
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Start earning" })
    );
    await expect(args.action?.onClick).toHaveBeenCalledOnce();
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/** No search results: the search icon, a title and no action. */
export const NoResults: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <EmptyState title="No tokens found" body="Try another name or symbol." />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};

export const TitleOnly: Story = {
  render: ({ title }) => (
    <div style={{ width: 360 }}>
      <EmptyState title={title} />
    </div>
  ),
};

/** `lg` and `fill`: a notice that fills the Widget, with a second action. */
export const Large: Story = {
  args: {
    size: "lg",
    fill: true,
    icon: "ArrowsLeftRightIcon",
    title: "Network not supported",
    body: "Switch to a supported network to continue.",
    action: { label: "Switch network", onClick: fn() },
    secondaryAction: { label: "Learn more", onClick: fn() },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Learn more" }));
    await expect(args.secondaryAction?.onClick).toHaveBeenCalledOnce();
  },
};
