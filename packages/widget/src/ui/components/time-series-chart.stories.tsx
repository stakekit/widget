import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { ContainerFrame } from "../storybook/container-frame";
import { Button } from "./button";
import {
  type TimeSeriesAxis,
  TimeSeriesChart,
  type TimeSeriesPoint,
} from "./time-series-chart";

const day = 24 * 60 * 60 * 1000;
/** 2026-01-01T00:00:00Z. */
const start = 1_767_225_600_000;
/** 2026-01-30T00:00:00Z, the last sample. */
const end = start + 29 * day;

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

// Round ticks as the Feature passes them: a step of 0.5 over 3.78–5.07, and
// of 0.5B over 1.25B–2.32B, one decimal count per axis.
const rewardRateAxis: TimeSeriesAxis = {
  ticks: [3.5, 4, 4.5, 5, 5.5],
  labels: ["3.5%", "4.0%", "4.5%", "5.0%", "5.5%"],
};

const tvlAxis: TimeSeriesAxis = {
  ticks: [1e9, 1.5e9, 2e9, 2.5e9],
  labels: ["$1.0B", "$1.5B", "$2.0B", "$2.5B"],
};

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

const timeAxisOver = (from: number, to: number): TimeSeriesAxis => {
  const ticks = [from, (from + to) / 2, to];
  return { ticks, labels: ticks.map(formatDate) };
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
    valueAxis: rewardRateAxis,
    timeAxis: timeAxisOver(start, end),
    formatTooltipValue: formatPercent,
    formatTooltipTime: formatLongDate,
    latestLabel: formatPercent(rewardRate.at(-1)?.value ?? 0),
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

const chartSurface = (frame: HTMLElement) =>
  waitFor(() => {
    const svg = frame.querySelector("svg");
    if (svg === null) throw new Error("Expected the chart surface");
    return svg;
  });

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
 * The value axis takes the Feature's round ticks, every label in one
 * precision.
 */
export const RoundValueTicks: Story = {
  play: async ({ canvasElement }) => {
    const frame = chart(canvasElement);
    await waitFor(() =>
      expect(within(frame).getAllByText(/^\d\.\d%$/u)).toHaveLength(5)
    );
  },
};

/** The latest point carries a dot and its value beside it. */
export const LatestPoint: Story = {
  play: async ({ canvasElement }) => {
    const frame = chart(canvasElement);
    const latest = within(frame).getByText("5.07%");
    await expect(latest).toBeVisible();
    const box = latest.getBoundingClientRect();
    const bounds = frame.getBoundingClientRect();
    await expect(box.right).toBeLessThanOrEqual(bounds.right);
    await expect(box.top).toBeGreaterThanOrEqual(bounds.top);
  },
};

/**
 * The time axis spans the whole selected range; where the data stops early,
 * the line ends there and a caption says so, in the same height.
 */
export const EndsEarly: Story = {
  args: {
    timeAxis: timeAxisOver(end - 59 * day, end + 30 * day),
    caption: "Data to Jan 30",
  },
  play: async ({ canvasElement }) => {
    const frame = chart(canvasElement);
    await expect(within(frame).getByText("Data to Jan 30")).toBeVisible();
    await expect(within(frame).getByText("Mar 1")).toBeVisible();
    await expect(frame.getBoundingClientRect().height).toBe(160);
  },
};

/** A range over six months labels its ticks by month and year. */
export const YearAxis: Story = {
  args: {
    timeAxis: {
      ticks: [start, (start + end) / 2, end],
      labels: ["Dec '24", "Jun '25", "Jan '26"],
    },
  },
  play: async ({ canvasElement }) => {
    const frame = chart(canvasElement);
    await waitFor(() =>
      expect(within(frame).getByText("Dec '24")).toBeVisible()
    );
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
    valueAxis: tvlAxis,
    formatTooltipValue: formatUsd,
    latestLabel: "$2.32B",
  },
  render: (args) => (
    <ContainerFrame width={400}>
      <TimeSeriesChart {...args} />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const frame = chart(canvasElement, "TVL history");
    await waitFor(() =>
      expect(frame.querySelectorAll("text").length).toBeGreaterThanOrEqual(8)
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
    await expect(within(frame).getAllByText(/^\$\d\.\dB$/u)).toHaveLength(4);
  },
};

export const NarrowContainerDark: Story = {
  ...NarrowContainer,
  globals: { colorScheme: "dark" },
};

/**
 * Hovering a point shows its value and time, formatted for the tooltip,
 * above the cursor so the line under it stays in view.
 */
export const Tooltip: Story = {
  play: async ({ canvasElement }) => {
    const frame = chart(canvasElement);
    const surface = await chartSurface(frame);
    const box = surface.getBoundingClientRect();
    const target = surface.parentElement ?? surface;
    const cursorY = box.top + box.height * 0.75;
    await waitFor(async () => {
      fireEvent.mouseMove(target, { clientX: box.left + 2, clientY: cursorY });
      await expect(within(frame).getByText("January 1, 2026")).toBeVisible();
    });
    await expect(within(frame).getByText("4.00%")).toBeVisible();
    const tooltip = within(frame)
      .getByText("January 1, 2026")
      .closest(".recharts-tooltip-wrapper");
    await waitFor(() =>
      expect(tooltip?.getBoundingClientRect().bottom).toBeLessThan(cursorY)
    );
  },
};

/**
 * The chart takes no focus: Tab moves straight past it, and a press on the
 * plot leaves focus where it was rather than ringing the plot.
 */
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

    const surface = chart(canvasElement).querySelector("svg");
    if (surface === null) throw new Error("Expected the chart surface");
    await userEvent.click(surface);
    await expect(surface).not.toHaveFocus();
    await expect(surface).not.toHaveAttribute("tabindex");
  },
};
