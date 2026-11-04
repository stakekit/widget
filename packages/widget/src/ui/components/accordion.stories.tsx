import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Text } from "../primitives/text";
import { Accordion } from "./accordion";

const meta = {
  title: "Components/Accordion",
  component: Accordion,
  args: {
    items: [
      {
        id: "what",
        title: "What is staking?",
        content: <Text as="p">Locking tokens to secure a network.</Text>,
      },
      {
        id: "when",
        title: "When are rewards paid?",
        content: <Text as="p">Every epoch.</Text>,
      },
      {
        id: "fees",
        title: "Are there fees?",
        content: <Text as="p">A share of the rewards.</Text>,
        disabled: true,
      },
    ],
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <Accordion {...args} />
    </div>
  ),
} satisfies Meta<typeof Accordion>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const OneOpen: Story = {
  args: { defaultOpen: "when" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", {
        name: "When are rewards paid?",
      })
    ).toHaveAttribute("aria-expanded", "true");
  },
};

export const OneOpenDark: Story = {
  args: { defaultOpen: "when" },
  globals: { colorScheme: "dark" },
};

/**
 * Each header is a Tab stop; Enter or Space opens one, and opening another
 * closes the first. Expanded state is each header's `aria-expanded`.
 */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const what = canvas.getByRole("button", { name: "What is staking?" });
    const when = canvas.getByRole("button", { name: "When are rewards paid?" });

    await userEvent.tab();
    await expect(what).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(what).toHaveAttribute("aria-expanded", "true");

    await userEvent.tab();
    await expect(when).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(when).toHaveAttribute("aria-expanded", "true");
    await expect(what).toHaveAttribute("aria-expanded", "false");
    await waitFor(() =>
      expect(
        canvas.queryByText("Locking tokens to secure a network.")
      ).toBeNull()
    );
  },
};

/** A disabled section does not open. */
export const DisabledItem: Story = {
  play: async ({ canvasElement }) => {
    const fees = within(canvasElement).getByRole("button", {
      name: "Are there fees?",
    });
    await userEvent.click(fees, { pointerEventsCheck: 0 });
    await expect(fees).toHaveAttribute("aria-expanded", "false");
  },
};

/** With `multiple`, sections open independently. */
export const Multiple: Story = {
  args: { multiple: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const what = canvas.getByRole("button", { name: "What is staking?" });
    const when = canvas.getByRole("button", { name: "When are rewards paid?" });

    await userEvent.click(what);
    await userEvent.click(when);
    await expect(what).toHaveAttribute("aria-expanded", "true");
    await expect(when).toHaveAttribute("aria-expanded", "true");
  },
};
