import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { brokenImage, networkLogo, tokenLogo } from "../storybook/images";
import { AssetHeader } from "./asset-header";

const titleOnlyArgs = {
  title: "Lido Staked ETH",
  token: { name: "stETH", src: tokenLogo, networkSrc: networkLogo },
};

const meta = {
  title: "Patterns/AssetHeader",
  component: AssetHeader,
  args: {
    ...titleOnlyArgs,
    provider: { name: "Lido", label: "via Lido", src: tokenLogo },
    details: ["Ethereum", "stETH"],
    badges: [
      { label: "Liquid staking", tone: "accent" },
      { label: "Auto-compounding" },
    ],
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <AssetHeader {...args} />
    </div>
  ),
} satisfies Meta<typeof AssetHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The name heads the page; the provider, facts and badges follow. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 2, name: "Lido Staked ETH" })
    ).toBeVisible();
    await expect(canvas.getByText("via Lido")).toBeVisible();
    await expect(canvas.getByText(/Ethereum · stETH/)).toBeVisible();
    await expect(canvas.getByText("Auto-compounding")).toBeVisible();
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

const avatarRadius = (wrapper: Element | null | undefined) => {
  const root = wrapper?.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error("Expected an avatar");
  return getComputedStyle(root).borderRadius;
};

/** The provider's logo is round, as the token's is. */
export const ProviderLogo: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByRole("heading", { name: "Lido Staked ETH" });
    const token = avatarRadius(heading.parentElement?.previousElementSibling);
    const provider = avatarRadius(
      canvas.getByText("via Lido").previousElementSibling
    );
    await expect(provider).toBe(token);
  },
};

/** Only the name and the token, as for a yield without a provider. */
export const TitleOnly: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <AssetHeader {...titleOnlyArgs} />
    </div>
  ),
};

/** Without logos, the initials stand in; long names truncate. */
export const FallbackAndLongName: Story = {
  args: {
    title: "Ethereum Liquid Staking Vault with a very long name",
    token: { name: "ETH", src: brokenImage },
    provider: { name: "Figment", label: "via Figment" },
  },
};

/** Compact, a position's page header: a 40px logo beside a heading. */
export const Compact: Story = {
  args: {
    density: "compact",
    badges: [{ label: "Action required", tone: "warning" }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByRole("heading", { name: "Lido Staked ETH" });
    const logo = heading.parentElement?.previousElementSibling;
    if (!(logo instanceof HTMLElement)) throw new Error("Expected a logo");
    await expect(logo.getBoundingClientRect().height).toBe(40);
    await expect(canvas.getByText("Action required")).toBeVisible();
  },
};
