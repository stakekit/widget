import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Text } from "../primitives/text";
import { InfoTip } from "./info-tip";

const explanation = "The yearly reward rate, before fees.";

const meta = {
  title: "Components/InfoTip",
  component: InfoTip,
  args: { label: "About the reward rate", children: explanation },
  render: (args) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        justifyContent: "center",
        paddingTop: 96,
      }}
    >
      <Text>Reward rate</Text>
      <InfoTip {...args} />
    </div>
  ),
  parameters: {
    // While open with focus kept on the button, Base UI renders focus guards:
    // `aria-hidden` spans that pass Tab on into and out of the portaled
    // popup. They are focus plumbing, not content, so the one rule they trip
    // skips them and still checks every other `aria-hidden` element.
    a11y: {
      config: {
        rules: [
          {
            id: "aria-hidden-focus",
            selector: '[aria-hidden="true"]:not([data-base-ui-focus-guard])',
          },
        ],
      },
    },
  },
} satisfies Meta<typeof InfoTip>;
export default meta;

type Story = StoryObj<typeof meta>;

// A press opening it, and focus a script returns to it staying closed, hang
// on `:focus-visible`, which Chromium sets only from trusted input; the
// dispatched events of a play cannot show them, so
// `tests/ui/components/info-tip.browser.test.tsx` does, with real input.

export const Closed: Story = {};

export const OpenDark: Story = {
  globals: { colorScheme: "dark" },
  play: async () => {
    await userEvent.tab();
    const text = await screen.findByText(explanation);
    await waitFor(() => expect(text).toBeVisible());
  },
};

/**
 * Keyboard focus opens it and keeps focus on the button, which it describes.
 * Escape closes it with focus still on the button; Enter opens it again.
 */
export const KeyboardFocus: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "About the reward rate",
    });

    await userEvent.tab();
    await expect(button).toHaveFocus();
    const text = await screen.findByText(explanation);
    await waitFor(() => expect(text).toBeVisible());
    await expect(button).toHaveFocus();
    await expect(button).toHaveAccessibleDescription(explanation);

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText(explanation)).toBeNull());
    await expect(button).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await screen.findByText(explanation);
  },
};
