import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ListSkeleton } from "./list-skeleton";

const meta = {
  title: "Patterns/ListSkeleton",
  component: ListSkeleton,
  args: { label: "Loading positions", rows: 5 },
  render: (args) => (
    <div style={{ width: 360 }}>
      <ListSkeleton {...args} />
    </div>
  ),
} satisfies Meta<typeof ListSkeleton>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Busy, named by its label, with the rows asked for. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status");
    await expect(status).toHaveAttribute("aria-busy", "true");
    await expect(status).toHaveTextContent("Loading positions");
    await expect(
      status.querySelectorAll(":scope > [aria-hidden]")
    ).toHaveLength(5);
  },
};

export const Dark: Story = { ...Default, globals: { colorScheme: "dark" } };
