import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { ContainerFrame } from "../storybook/container-frame";
import { Button } from "./button";
import { TimeSeriesChart, type TimeSeriesPoint } from "./time-series-chart";

const day = 24 * 60 * 60 * 1000;
/** 2026-01-01T00:00:00Z. */
const start = 1_767_225_600_000;

const rewardRate: ReadonlyArray<TimeSeriesPoint> = Array.from(
  { length: 30 },
  (_, index) => ({
    time: start + index * day,
    value: 4 + Math.sin(index / 4) * 0.6 + index * 0.02,
  })
);

const tvl: ReadonlyArray<TimeSeriesPoint> = rewardRate.map((point, index) => ({
  time: point.time,
  value: 1_250_000_000 + index * 37_000_000,
}));

const monthNames: ReadonlyArray<string> = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The UTC calendar date of an epoch time, from Howard Hinnant's civil-from-days. */
const utcDate = (time: number) => {
  const days = Math.floor(time / day) + 719_468;
  const era = Math.floor(days / 146_097);
  const dayOfEra = days - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365
  );
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153);
  const month = shiftedMonth < 10 ? shiftedMonth + 2 : shiftedMonth - 10;
  return {
    year: yearOfEra + era * 400 + (month < 2 ? 1 : 0),
    month: monthNames[month] ?? "",
    day: dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1,
  };
};

const formatDate = (time: number) => {
  const date = utcDate(time);
  return `${date.month.slice(0, 3)} ${date.day}`;
};

const formatLongDate = (time: number) => {
  const date = utcDate(time);
  return `${date.month} ${date.day}, ${date.year}`;
};

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

const formatUsd = (value: number) => {
  const [whole = "", fraction = ""] = value.toFixed(2).split(".");
  return `$${whole.replace(/\B(?=(\d{3})+$)/g, ",")}.${fraction}`;
};

const meta = {
  title: "Components/TimeSeriesChart",
  component: TimeSeriesChart,
  args: {
    label: "Reward rate history",
    data: rewardRate,
    formatValue: formatPercent,
    formatTime: formatDate,
    formatTooltipTime: formatLongDate,
    emptyLabel: "No chart data",
  },
  render: (args) => (
    <ContainerFrame width={520}>
      <TimeSeriesChart {...args} />
    </ContainerFrame>
  ),
} satisfies Meta<typeof TimeSeriesChart>;
export default meta;

type Story = StoryObj<typeof meta>;

const chart = (canvasElement: HTMLElement, name = "Reward rate history") =>
  within(canvasElement).getByRole("img", { name });

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const svg = chart(canvasElement).querySelector("svg");
    await waitFor(() => expect(svg?.querySelector("path")).not.toBeNull());
    await waitFor(() =>
      expect(within(chart(canvasElement)).getByText("Jan 1")).toBeVisible()
    );
  },
};

export const Dark: Story = { globals: { colorScheme: "dark" } };

/** Without points yet, a skeleton holds the chart's place. */
export const Loading: Story = {
  args: { data: [], loading: true },
  play: async ({ canvasElement }) => {
    const frame = chart(canvasElement);
    await expect(frame).toHaveAttribute("aria-busy", "true");
    await expect(frame.querySelector("svg")).toBeNull();
  },
};

/** With points, the chart dims under a spinner while new ones load. */
export const Refreshing: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const frame = chart(canvasElement);
    await expect(frame).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(frame.querySelector("svg")).not.toBeNull());
  },
};

/**
 * Fewer than two points draw no line; the message reads inside a named
 * figure, not an image that would hide it.
 */
export const Empty: Story = {
  args: { data: rewardRate.slice(0, 1) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = canvas.getByRole("figure", { name: "Reward rate history" });
    await expect(within(frame).getByText("No chart data")).toBeVisible();
    await expect(canvas.queryByRole("img")).toBeNull();
  },
};

/**
 * At the narrowest supported container, 400px, long value labels and the
 * edge time labels stay inside the chart.
 */
export const NarrowContainer: Story = {
  args: {
    label: "TVL history",
    data: tvl,
    formatValue: formatUsd,
  },
  render: (args) => (
    <ContainerFrame width={400}>
      <TimeSeriesChart {...args} />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const frame = chart(canvasElement, "TVL history");
    await waitFor(() =>
      expect(frame.querySelectorAll("text").length).toBeGreaterThanOrEqual(6)
    );
    const bounds = frame.getBoundingClientRect();
    for (const label of frame.querySelectorAll("text")) {
      const box = label.getBoundingClientRect();
      await expect(box.width).toBeGreaterThan(0);
      await expect(box.left).toBeGreaterThanOrEqual(bounds.left);
      await expect(box.right).toBeLessThanOrEqual(bounds.right);
      await expect(box.top).toBeGreaterThanOrEqual(bounds.top);
      await expect(box.bottom).toBeLessThanOrEqual(bounds.bottom);
    }
    await expect(within(frame).getAllByText(/^\$[\d,.]+$/)).toHaveLength(3);
  },
};

export const NarrowContainerDark: Story = {
  ...NarrowContainer,
  globals: { colorScheme: "dark" },
};

/**
 * `formatValueAxis` labels the value ticks together, so every label of the
 * axis shares one precision.
 */
export const SharedAxisPrecision: Story = {
  args: {
    formatValueAxis: (ticks) => ticks.map((tick) => `${tick.toFixed(1)}%`),
  },
  play: async ({ canvasElement }) => {
    const frame = chart(canvasElement);
    await waitFor(() =>
      expect(within(frame).getAllByText(/^\d+\.\d%$/u)).toHaveLength(3)
    );
  },
};

/** Hovering a point shows its value and time, formatted for the tooltip. */
export const Tooltip: Story = {
  play: async ({ canvasElement }) => {
    const frame = chart(canvasElement);
    const surface = await waitFor(() => {
      const svg = frame.querySelector("svg");
      if (svg === null) throw new Error("Expected the chart surface");
      return svg;
    });
    const box = surface.getBoundingClientRect();
    const target = surface.parentElement ?? surface;
    await waitFor(async () => {
      fireEvent.mouseMove(target, {
        clientX: box.left + 2,
        clientY: box.top + box.height / 2,
      });
      await expect(within(frame).getByText("January 1, 2026")).toBeVisible();
    });
    await expect(within(frame).getByText("4.00%")).toBeVisible();
  },
};

/** The chart takes no focus: Tab moves straight past it. */
export const NoFocusStop: Story = {
  render: (args) => (
    <ContainerFrame width={520}>
      <Button variant="secondary">Before</Button>
      <TimeSeriesChart {...args} />
      <Button variant="secondary">After</Button>
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(chart(canvasElement).querySelector("svg")).not.toBeNull()
    );
    canvas.getByRole("button", { name: "Before" }).focus();

    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "After" })).toHaveFocus();
  },
};
