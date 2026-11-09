import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { glyphs, type IconName } from "../icons/glyphs";
import { Grid } from "./grid";
import { Icon } from "./icon";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
  title: "Primitives/Icon",
  component: Icon,
  args: { name: "InfoIcon" },
} satisfies Meta<typeof Icon>;
export default meta;

type Story = StoryObj<typeof meta>;

const isIconName = (key: string): key is IconName => Object.hasOwn(glyphs, key);

const names = Object.keys(glyphs).filter(isIconName);

/** Every icon the Widget renders, on one grid and one 1.5px stroke. */
export const AllIcons: Story = {
  render: () => (
    <Grid columns={3} gap={12}>
      {names.map((name) => (
        <Stack key={name} direction="row" align="center" gap={8}>
          {name === "ArrowIcon" ? (
            <Icon name={name} direction="down" />
          ) : (
            <Icon name={name} />
          )}
          <Text variant="caption">{name}</Text>
        </Stack>
      ))}
    </Grid>
  ),
};

export const AllIconsDark: Story = {
  ...AllIcons,
  globals: { colorScheme: "dark" },
};

const sizes = ["sm", "md", "lg", "xl"] as const;

/** Every icon at every size: the line stays 1.5px whatever the size. */
export const EverySize: Story = {
  render: () => (
    <Grid columns={2} gap={12}>
      {names.map((name) => (
        <Stack key={name} direction="row" align="center" gap={12}>
          {sizes.map((size) =>
            name === "ArrowIcon" ? (
              <Icon key={size} name={name} direction="down" size={size} />
            ) : (
              <Icon key={size} name={name} size={size} />
            )
          )}
          <Text variant="caption">{name}</Text>
        </Stack>
      ))}
    </Grid>
  ),
};

export const EverySizeDark: Story = {
  ...EverySize,
  globals: { colorScheme: "dark" },
};

const tones = [
  "default",
  "muted",
  "subtle",
  "accent",
  "success",
  "warning",
  "danger",
] as const;

export const Tones: Story = {
  render: () => (
    <Stack direction="row" gap={12}>
      {tones.map((tone) => (
        <Icon key={tone} name="CheckCircleIcon" tone={tone} label={tone} />
      ))}
    </Stack>
  ),
};

export const TonesDark: Story = { ...Tones, globals: { colorScheme: "dark" } };

export const ArrowDirections: Story = {
  render: () => (
    <Stack direction="row" gap={12}>
      <Icon name="ArrowIcon" direction="down" label="Down" />
      <Icon name="ArrowIcon" direction="up" label="Up" />
      <Icon name="ArrowIcon" direction="left" label="Left" />
      <Icon name="ArrowIcon" direction="right" label="Right" />
    </Stack>
  ),
};

/** With a label the icon is an image with that name; without, it is hidden. */
export const Labelled: Story = {
  args: { name: "WarningIcon", label: "Warning", tone: "warning" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("img", { name: "Warning" })
    ).toBeVisible();
  },
};
