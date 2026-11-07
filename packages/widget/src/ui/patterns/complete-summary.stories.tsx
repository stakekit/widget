import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  brokenImage,
  networkLogo,
  providerLogo,
  tokenLogo,
} from "../storybook/images";
import { CompleteSummary } from "./complete-summary";

const meta = {
  title: "Patterns/CompleteSummary",
  component: CompleteSummary,
  args: {
    title: "Successfully restaked 0.001 ETH",
    detail: "via Ether.fi",
    rows: [
      {
        label: "You received",
        value: "0.001 eETH",
        caption: "$2.42",
        testId: "received",
      },
    ],
    transactions: {
      heading: "Transactions",
      newTabLabel: "opens in a new tab",
      items: [
        {
          id: "approve",
          label: "Approve",
          href: "https://etherscan.io/tx/0x1",
          hash: "0x12ab…9f3c",
          viewLabel: "View Approve transaction",
        },
        {
          id: "stake",
          label: "Stake",
          href: "https://etherscan.io/tx/0x2",
          hash: "0x34cd…1a2b",
          viewLabel: "View Stake transaction",
        },
      ],
    },
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <CompleteSummary {...args} />
    </div>
  ),
} satisfies Meta<typeof CompleteSummary>;
export default meta;

type Story = StoryObj<typeof meta>;

const markOf = (canvasElement: HTMLElement) =>
  within(canvasElement).getByTestId("complete-mark");

/** The mark's box once its entrance (a scale-in) finishes. */
const settledMarkBox = async (mark: HTMLElement) => {
  await Promise.all(
    mark.getAnimations({ subtree: true }).map((animation) => animation.finished)
  );
  return mark.getBoundingClientRect();
};

/**
 * The mark shows `src` at 56px, with the success badge's check; the badge
 * sits at the bottom end, inside the avatar's footprint.
 */
const expectMarkImage = async (canvasElement: HTMLElement, src: string) => {
  const mark = markOf(canvasElement);
  await waitFor(() =>
    expect(mark.querySelector("img")?.getAttribute("src")).toBe(src)
  );
  const box = await settledMarkBox(mark);
  await expect(box.width).toBe(56);
  await expect(box.height).toBe(56);
  const check = mark.querySelector("svg")?.getBoundingClientRect();
  await expect(check).toBeDefined();
  if (check === undefined) return;
  await expect(check.left).toBeGreaterThan(box.left + box.width / 2);
  await expect(check.top).toBeGreaterThan(box.top + box.height / 2);
  await expect(check.right).toBeLessThanOrEqual(box.right);
  await expect(check.bottom).toBeLessThanOrEqual(box.bottom);
};

/**
 * The received token's logo leads the summary with a success check badge in
 * its corner, where a token's network badge sits.
 */
export const TokenMark: Story = {
  args: {
    mark: { name: "eETH", tokenSrc: tokenLogo, providerSrc: networkLogo },
  },
  play: async ({ canvasElement }) => {
    await expectMarkImage(canvasElement, tokenLogo);
  },
};

export const TokenMarkDark: Story = {
  ...TokenMark,
  globals: { colorScheme: "dark" },
};

/** A token logo that fails gives way to the provider's logo. */
export const ProviderMarkFallback: Story = {
  args: {
    mark: { name: "eETH", tokenSrc: brokenImage, providerSrc: networkLogo },
  },
  play: async ({ canvasElement }) => {
    await expectMarkImage(canvasElement, networkLogo);
  },
};

/**
 * Who ran the action leads the "via" line with its logo, as on Review and
 * Steps: a chosen validator's square, while the token's logo stays the mark.
 */
export const ValidatorAttribution: Story = {
  args: {
    detail: "via Figment",
    mark: { name: "eETH", tokenSrc: tokenLogo, providerSrc: providerLogo },
    provider: { name: "Figment", shape: "square", src: providerLogo },
  },
  play: async ({ canvasElement }) => {
    await expectMarkImage(canvasElement, tokenLogo);
    const line = within(canvasElement).getByText("via Figment").parentElement;
    await waitFor(() =>
      expect(line?.querySelector("img")?.getAttribute("src")).toBe(providerLogo)
    );
  },
};

export const ValidatorAttributionDark: Story = {
  ...ValidatorAttribution,
  globals: { colorScheme: "dark" },
};

/**
 * Without a logo that loads, the plain check shows: no image, and no
 * loading initial in place of one. It draws in as the mark settles.
 */
export const CheckMarkFallback: Story = {
  args: {
    mark: { name: "eETH", tokenSrc: brokenImage, providerSrc: brokenImage },
  },
  play: async ({ canvasElement }) => {
    const mark = markOf(canvasElement);
    // The plain check is a 32px icon; a badge's check is far smaller.
    await waitFor(() =>
      expect(mark.querySelector("svg")?.getBoundingClientRect().width).toBe(32)
    );
    await expect(mark).toHaveTextContent(/^$/u);
    await expect(mark.querySelector("img")).toBeNull();
    const check = mark.querySelector("svg");
    await expect(check?.parentElement?.getAnimations()).toHaveLength(1);
    await expect((await settledMarkBox(mark)).width).toBe(56);
  },
};

/**
 * Once the check has drawn, a success ring beats out from the mark once and
 * fades; reduced motion skips it (see
 * `complete-summary-reduced-motion.browser.test.tsx`).
 */
export const SuccessBeat: Story = {
  play: async ({ canvasElement }) => {
    const beat = within(canvasElement).getByTestId("complete-mark-beat");
    const [animation] = beat.getAnimations();
    await expect(animation).toBeDefined();
    await expect(getComputedStyle(beat).animationIterationCount).toBe("1");
    await animation?.finished;
    await expect(getComputedStyle(beat).opacity).toBe("0");
  },
};

/**
 * The position the action left leads the details: what it holds with its
 * fiat value, and a year's projected earnings in the success tone. The hero
 * is centred; the card reads from the start.
 */
export const WithPosition: Story = {
  args: {
    title: "Successfully staked 1.5 ETH",
    detail: "via Figment",
    rows: [],
    position: {
      heading: "Your position",
      value: "3.2 ETH",
      caption: "$10,240.00",
      earnings: {
        label: "Projected yearly earnings",
        value: "+0.05 ETH",
        caption: "$160.00",
        testId: "yearly-earnings",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByTestId("complete-position");
    await expect(card).toHaveTextContent("Your position3.2 ETH$10,240.00");
    const earnings = within(card).getByTestId("yearly-earnings");
    await expect(earnings).toHaveTextContent("+0.05 ETH");
    const heading = canvas.getByRole("heading", { level: 2 });
    await expect(getComputedStyle(heading).textAlign).toBe("center");
    await expect(
      getComputedStyle(within(card).getByText("Your position")).textAlign
    ).not.toBe("center");
  },
};

export const WithPositionDark: Story = {
  ...WithPosition,
  globals: { colorScheme: "dark" },
};

/**
 * A success mark over what happened, what it returned, and its transactions
 * as a compact list of explorer links.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", {
        level: 2,
        name: "Successfully restaked 0.001 ETH",
      })
    ).toBeVisible();
    await expect(
      within(canvas.getByTestId("received")).getByText("0.001 eETH")
    ).toBeVisible();
    const list = canvas.getByRole("list", { name: "Transactions" });
    await expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    await expect(
      within(list).getByRole("link", { name: /View Stake transaction/u })
    ).toHaveAttribute("href", "https://etherscan.io/tx/0x2");
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/** An exit says what is left to do: withdraw once the funds unlock. */
export const WithNote: Story = {
  args: {
    title: "Successfully unstaked 12.57 POL",
    rows: [],
    note: "12.57 POL unlocks around Nov 12. Come back then to withdraw it from your position.",
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/unlocks around Nov 12/u)
    ).toBeVisible();
  },
};

/** Opening a transaction's link reports it, such as to record the visit. */
export const OpensTransaction: Story = {
  args: {
    transactions: {
      heading: "Transactions",
      newTabLabel: "opens in a new tab",
      items: [
        {
          id: "stake",
          label: "Stake",
          href: "https://etherscan.io/tx/0x2",
          viewLabel: "View Stake transaction",
        },
      ],
      onOpen: fn(),
    },
  },
  beforeEach: () => {
    // Keep the test page from opening the explorer in a new tab.
    const stay = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("click", stay, { capture: true });
    return () => window.removeEventListener("click", stay, { capture: true });
  },
  play: async ({ args, canvasElement }) => {
    const link = within(canvasElement).getByRole("link", {
      name: /View Stake transaction/u,
    });
    await userEvent.click(link);
    await expect(args.transactions?.onOpen).toHaveBeenCalledOnce();
  },
};

/** Only what happened, for an action that sent nothing to show. */
export const TitleOnly: Story = {
  render: ({ title }) => (
    <div style={{ width: 360 }}>
      <CompleteSummary title={title} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("list")).toBeNull();
  },
};
