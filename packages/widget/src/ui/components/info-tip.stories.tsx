import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { isWithin } from "../storybook/geometry";
import { PopupFrame } from "../storybook/popup-frame";
import { ExternalLink } from "./external-link";
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

/**
 * An action at its end, such as opening a campaign's details: pressing it
 * runs the action and closes the tip, so what it opens takes its place.
 */
export const WithAction: Story = {
  args: {
    action: { label: "View campaign details", onClick: fn() },
  },
  play: async ({ args }) => {
    await userEvent.tab();
    const action = await screen.findByRole("button", {
      name: "View campaign details",
    });
    await userEvent.click(action);
    await expect(args.action?.onClick).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText(explanation)).toBeNull());
  },
};

const scale =
  "Credora grades how likely a deposit is to lose 1% or more within a year, from A+, the lowest risk, to D, the highest.";

/**
 * An explanation in a few paragraphs that ends in a link to its source, such
 * as a risk rating's. Tab moves from the button into the explanation, to the
 * link, and the explanation stays open while focus is in it.
 */
export const WithLink: Story = {
  args: {
    label: "Risk rating details",
    children: (
      <Stack gap={8}>
        <Text as="p">{scale}</Text>
        <Text as="p" weight="medium">
          A is one of its lowest-risk grades.
        </Text>
        <Text as="p" variant="caption" tone="muted">
          A rating is an independent opinion, not a guarantee against loss.
        </Text>
        <Text as="p" variant="caption">
          <ExternalLink
            href="https://example.com/methodology"
            newTabLabel="opens in a new tab"
          >
            How Credora rates
          </ExternalLink>
        </Text>
      </Stack>
    ),
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "Risk rating details",
    });
    await userEvent.tab();
    await expect(button).toHaveFocus();
    const link = await screen.findByRole("link", { name: /How Credora rates/ });
    await waitFor(() => expect(link).toBeVisible());

    await userEvent.tab();
    await expect(link).toHaveFocus();
    await expect(screen.getByText(scale)).toBeVisible();
  },
};

/**
 * It stays inside the Widget's frame: by an info button at the frame's top
 * right corner, the explanation flips under the button and shifts left
 * rather than passing the frame's edges, though the page has room beyond
 * them.
 */
export const StaysInFrame: Story = {
  args: {
    label: "About the reward rate",
    children:
      "The yearly rate a position earns in rewards, before fees. It can change over time.",
  },
  render: (args) => (
    <PopupFrame>
      <Text>Reward rate</Text>
      <InfoTip {...args} />
    </PopupFrame>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const explanation = await screen.findByRole("dialog", {
      name: "About the reward rate",
    });
    await waitFor(() => expect(explanation).toBeVisible());
    const frame = within(canvasElement).getByTestId("frame");
    await waitFor(() =>
      expect(
        isWithin(
          explanation.getBoundingClientRect(),
          frame.getBoundingClientRect()
        )
      ).toBe(true)
    );
  },
};
