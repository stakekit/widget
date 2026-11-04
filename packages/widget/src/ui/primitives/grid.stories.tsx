import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Card } from "../components/card";
import { ContainerFrame, narrowAndWide } from "../storybook/container-frame";
import { Grid } from "./grid";
import { Text } from "./text";

const cells = (count: number) =>
  Array.from({ length: count }, (_, index) => (
    <Card key={index} padding={12}>
      <Text>{`Cell ${index + 1}`}</Text>
    </Card>
  ));

const meta = {
  title: "Primitives/Grid",
  component: Grid,
  args: { gap: 8, children: cells(4) },
} satisfies Meta<typeof Grid>;
export default meta;

type Story = StoryObj<typeof meta>;

export const OneColumn: Story = { args: { columns: 1 } };
export const TwoColumns: Story = { args: { columns: 2 } };
export const ThreeColumns: Story = { args: { columns: 3, children: cells(6) } };
export const FourColumns: Story = { args: { columns: 4 } };

/** As many metric columns as the width allows. */
export const Metrics: Story = {
  args: { columns: "metrics", children: cells(5) },
};

/** The split view's aside and main pane. */
export const Split: Story = { args: { columns: "split", children: cells(2) } };

/** One column below the `md` container size, two from it up. */
export const Responsive: Story = {
  args: {
    columns: { base: 1, md: 2 },
    role: "group",
    "aria-label": "Cells",
  },
  render: (args) => (
    <Grid gap={16}>
      <ContainerFrame width={380}>
        <Grid {...args} />
      </ContainerFrame>
      <ContainerFrame width={600}>
        <Grid {...args} />
      </ContainerFrame>
    </Grid>
  ),
  play: async ({ canvasElement }) => {
    const [narrow, wide] = narrowAndWide(
      within(canvasElement).getAllByRole("group", { name: "Cells" })
    );
    const columnCount = (element: HTMLElement) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length;
    await expect(columnCount(narrow)).toBe(1);
    await expect(columnCount(wide)).toBe(2);
  },
};
