import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Badge } from "./badge";
import { DetailList, DetailRow } from "./detail-list";
import { ExpandableAmount } from "./expandable-amount";

const address = "0x9f8d3e2b7c1a4f6e5d0c8b7a6f5e4d3c2b1a0f9e";

const meta = {
  title: "Components/DetailList",
  component: DetailList,
  args: {
    children: (
      <>
        <DetailRow label="Reward rate" value="4.21%" />
        <DetailRow
          label="Staked"
          value={<ExpandableAmount short="1.23K ETH" full="1,234.5678 ETH" />}
        />
        <DetailRow
          label="Status"
          value={<Badge tone="warning">Pending</Badge>}
        />
        <DetailRow
          label="Validator"
          value="0x9f8d…0f9e"
          copyable={{
            value: address,
            label: "Copy address",
            copiedLabel: "Copied",
          }}
        />
      </>
    ),
  },
} satisfies Meta<typeof DetailList>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Rows: Story = {};

export const RowsDark: Story = { globals: { colorScheme: "dark" } };

/**
 * The copy button copies the full value, shows a check and announces the
 * outcome. The story replaces the clipboard, so nothing leaves the page.
 */
export const Copy: Story = {
  beforeEach: () => {
    const clipboard = navigator.clipboard;
    const writeText = fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    return () => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: clipboard,
      });
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copy address" }));

    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(address);
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Copied")
    );
  },
};
