/**
 * Measures initial-mount animation smoothness in a clean Chromium.
 *
 * Frame pacing is judged against the observed refresh rate rather than an
 * assumed 60Hz, and the animation window is isolated from page load so dev
 * server module loading does not drown out the signal.
 *
 * Browser-side code is passed as strings on purpose: esbuild's keepNames
 * transform injects a `__name` helper that does not exist inside the page.
 *
 * Usage: tsx scripts/measure-mount-jank.mts [url] [runs]
 *        tsx scripts/measure-mount-jank.mts [url] --profile
 *
 * --profile takes a single CPU profile of the mount and ranks functions by self
 * time. Point it at the dev server: a production build is minified, so its
 * frame names carry no meaning.
 */
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5173";
const profileMode = process.argv.includes("--profile");
const runs = Number(process.argv[3] ?? 5);
const mountTimeoutMs = 25_000;

const initScript = `
  window.__jank = {
    animationStartMs: null,
    completionMs: null,
    liveNode: null,
    observingContainer: false,
    frames: [],
    layoutShift: 0,
    longTasks: [],
    heights: []
  };

  new PerformanceObserver(function (list) {
    var entries = list.getEntries();
    for (var i = 0; i < entries.length; i += 1) {
      window.__jank.longTasks.push({
        duration: entries[i].duration,
        start: entries[i].startTime
      });
    }
  }).observe({ buffered: true, type: "longtask" });

  new PerformanceObserver(function (list) {
    var entries = list.getEntries();
    for (var i = 0; i < entries.length; i += 1) {
      if (!entries[i].hadRecentInput) {
        window.__jank.layoutShift += entries[i].value;
      }
    }
  }).observe({ buffered: true, type: "layout-shift" });

  // The frame loop stays free of layout-forcing reads: querySelector,
  // textContent and getBoundingClientRect each frame cost more than the jank
  // being measured. hasAttribute on a cached node is safe.
  function jankTick() {
    var probe = window.__jank;
    var now = performance.now();
    probe.frames.push(now);

    if (
      probe.completionMs === null &&
      probe.liveNode !== null &&
      !probe.liveNode.hasAttribute("inert")
    ) {
      probe.completionMs = now;
    }

    requestAnimationFrame(jankTick);
  }
  requestAnimationFrame(jankTick);

  var containerObserver = new ResizeObserver(function (entries) {
    var probe = window.__jank;
    for (var i = 0; i < entries.length; i += 1) {
      var height = entries[i].contentRect.height;
      probe.heights.push(height);
      if (probe.animationStartMs === null && height > 1) {
        probe.animationStartMs = performance.now();
      }
    }
  });

  new MutationObserver(function () {
    var probe = window.__jank;

    if (!probe.observingContainer) {
      var container = document.querySelector("[data-rk='widget-container']");
      if (container) {
        probe.observingContainer = true;
        containerObserver.observe(container);
      }
    }

    if (probe.liveNode === null) {
      probe.liveNode = document.querySelector(
        "[data-rk='earn-live-presentation']"
      );
    }
    // document is observed rather than documentElement: init scripts run before
    // the document element exists, and observing null throws.
  }).observe(document, { childList: true, subtree: true });
`;

const readProbe = `(function () {
  var probe = window.__jank;
  var apiResponses = performance.getEntriesByType("resource")
    .filter(function (entry) { return /yields|stakek\\.it/.test(entry.name); })
    .map(function (entry) {
      return { name: entry.name.slice(-60), responseEnd: entry.responseEnd };
    });

  return {
    animationStartMs: probe.animationStartMs,
    apiResponses: apiResponses,
    completionMs: probe.completionMs,
    frames: probe.frames,
    layoutShift: probe.layoutShift,
    longTasks: probe.longTasks,
    maxHeight: probe.heights.length ? Math.max.apply(null, probe.heights) : 0
  };
})()`;

type Sample = {
  readonly animationMs: number;
  readonly droppedFrames: number;
  readonly lastApiResponseOffsetMs: number;
  readonly longTaskMsInWindow: number;
  readonly longestFrameMs: number;
  readonly longestTaskInWindowMs: number;
  readonly longestTaskOffsetMs: number;
  readonly layoutShift: number;
  readonly maxHeight: number;
  readonly medianFrameMs: number;
  readonly mountDroppedFrames: number;
  readonly mountLongestFrameMs: number;
  readonly mountLongestTaskMs: number;
  readonly mountLongTaskMs: number;
  readonly reachedCompletion: boolean;
  readonly tasksNearBoundary: ReadonlyArray<{
    readonly durationMs: number;
    readonly offsetMs: number;
  }>;
};

const median = (values: ReadonlyArray<number>) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
};

const collect = async (): Promise<Sample> => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { height: 900, width: 500 },
    });
    await page.addInitScript({ content: initScript });
    await page.goto(url, { waitUntil: "commit" });
    await page
      .waitForFunction("window.__jank && window.__jank.completionMs !== null", {
        timeout: mountTimeoutMs,
      })
      .catch(() => undefined);

    const result = (await page.evaluate(readProbe)) as {
      animationStartMs: number | null;
      apiResponses: ReadonlyArray<{ name: string; responseEnd: number }>;
      completionMs: number | null;
      frames: number[];
      layoutShift: number;
      longTasks: ReadonlyArray<{ duration: number; start: number }>;
      maxHeight: number;
    };

    // Only the animation window matters; page load noise sits before it.
    const from = result.animationStartMs ?? 0;
    const to = result.completionMs ?? result.frames.at(-1) ?? from;

    const framesBetween = (start: number, end: number) => {
      const selected = result.frames.filter(
        (timestamp) => timestamp >= start && timestamp <= end
      );

      return selected
        .slice(1)
        .map((timestamp, index) => timestamp - selected[index]!);
    };
    const tasksBetween = (start: number, end: number) =>
      result.longTasks.filter(
        (task) => task.start + task.duration >= start && task.start <= end
      );

    const gaps = framesBetween(from, to);
    const medianFrameMs = median(gaps);
    const tasksInWindow = tasksBetween(from, to);
    // The reveal-relative window opens at first measurable growth, so work that
    // lands just before it — notably the mount commit — sits outside it.
    const mountGaps = framesBetween(0, to);
    const mountTasks = tasksBetween(0, to);
    const longestTask = tasksInWindow.reduce<{
      duration: number;
      start: number;
    } | null>(
      (worst, task) =>
        worst === null || task.duration > worst.duration ? task : worst,
      null
    );
    const lastApiResponseEnd =
      result.apiResponses.length > 0
        ? Math.max(...result.apiResponses.map((entry) => entry.responseEnd))
        : 0;

    return {
      animationMs: to - from,
      lastApiResponseOffsetMs:
        lastApiResponseEnd === 0 ? -1 : lastApiResponseEnd - from,
      longestTaskOffsetMs: longestTask === null ? -1 : longestTask.start - from,
      // A dropped frame is one that took materially longer than this display's
      // own steady-state pace, so the check holds at 60Hz and 120Hz alike.
      droppedFrames: gaps.filter((gap) => gap > medianFrameMs * 1.8).length,
      layoutShift: result.layoutShift,
      longestFrameMs: gaps.length > 0 ? Math.max(...gaps) : 0,
      longestTaskInWindowMs:
        tasksInWindow.length > 0
          ? Math.max(...tasksInWindow.map((task) => task.duration))
          : 0,
      longTaskMsInWindow: tasksInWindow.reduce(
        (total, task) => total + task.duration,
        0
      ),
      maxHeight: result.maxHeight,
      medianFrameMs,
      mountDroppedFrames: mountGaps.filter((gap) => gap > medianFrameMs * 1.8)
        .length,
      mountLongTaskMs: mountTasks.reduce(
        (total, task) => total + task.duration,
        0
      ),
      mountLongestFrameMs: mountGaps.length > 0 ? Math.max(...mountGaps) : 0,
      mountLongestTaskMs:
        mountTasks.length > 0
          ? Math.max(...mountTasks.map((task) => task.duration))
          : 0,
      reachedCompletion: result.completionMs !== null,
      tasksNearBoundary: result.longTasks
        .filter((task) => task.start >= from - 600 && task.start <= from + 400)
        .map((task) => ({
          durationMs: task.duration,
          offsetMs: task.start - from,
        })),
    };
  } finally {
    await browser.close();
  }
};

type ProfileNode = {
  readonly callFrame: {
    readonly functionName: string;
    readonly lineNumber: number;
    readonly url: string;
  };
  readonly id: number;
};

const profileMount = async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { height: 900, width: 500 },
    });
    await page.addInitScript({ content: initScript });

    const session = await page.context().newCDPSession(page);
    await session.send("Profiler.enable");
    await session.send("Profiler.setSamplingInterval", { interval: 100 });
    await session.send("Profiler.start");

    await page.goto(url, { waitUntil: "commit" });
    await page
      .waitForFunction("window.__jank && window.__jank.completionMs !== null", {
        timeout: mountTimeoutMs,
      })
      .catch(() => undefined);

    const { profile } = (await session.send("Profiler.stop")) as {
      profile: {
        endTime: number;
        nodes: ReadonlyArray<ProfileNode>;
        samples: ReadonlyArray<number>;
        timeDeltas: ReadonlyArray<number>;
      };
    };
    const marks = (await page.evaluate(
      "({ now: performance.now(), start: window.__jank.animationStartMs })"
    )) as { now: number; start: number | null };

    // Profiler timestamps are monotonic microseconds; anchor them to the page
    // clock using "now" as a shared reference point.
    const offsetMs = profile.endTime / 1000 - marks.now;
    const nodesById = new Map(profile.nodes.map((node) => [node.id, node]));
    const revealStart = marks.start ?? 0;
    const selfTimeAll = new Map<string, number>();
    const selfTimeNearReveal = new Map<string, number>();

    let cursorUs =
      profile.endTime - profile.timeDeltas.reduce((a, b) => a + b, 0);
    profile.samples.forEach((nodeId, index) => {
      const deltaUs = profile.timeDeltas[index] ?? 0;
      cursorUs += deltaUs;
      const node = nodesById.get(nodeId);
      if (!node) return;

      const frame = node.callFrame;
      const shortUrl = frame.url
        .replace(/^https?:\/\/[^/]+/, "")
        .replace(/\?.*$/, "");
      const label = `${frame.functionName || "(anonymous)"}  ${shortUrl}:${frame.lineNumber}`;
      const deltaMs = deltaUs / 1000;

      selfTimeAll.set(label, (selfTimeAll.get(label) ?? 0) + deltaMs);

      const atMs = cursorUs / 1000 - offsetMs;
      if (atMs >= revealStart - 250 && atMs <= revealStart + 250) {
        selfTimeNearReveal.set(
          label,
          (selfTimeNearReveal.get(label) ?? 0) + deltaMs
        );
      }
    });

    const top = (totals: Map<string, number>, count: number) =>
      [...totals.entries()]
        .filter(([label]) => !label.startsWith("(program)"))
        .sort((first, second) => second[1] - first[1])
        .slice(0, count);

    console.log(`\nCPU profile of mount at ${url}\n`);
    console.log("top self time, whole mount:");
    for (const [label, ms] of top(selfTimeAll, 20)) {
      console.log(`  ${ms.toFixed(1).padStart(7)} ms  ${label}`);
    }
    console.log("\ntop self time, +/-250ms around reveal start:");
    for (const [label, ms] of top(selfTimeNearReveal, 20)) {
      console.log(`  ${ms.toFixed(1).padStart(7)} ms  ${label}`);
    }
  } finally {
    await browser.close();
  }
};

if (profileMode) {
  await profileMount();
  process.exit(0);
}

const samples: Sample[] = [];
for (let run = 0; run < runs; run += 1) {
  samples.push(await collect());
}

const report = (label: string, pick: (sample: Sample) => number) => {
  const values = samples.map(pick);
  console.log(
    `${label.padEnd(24)} median ${median(values).toFixed(1).padStart(8)}   all [${values
      .map((value) => value.toFixed(1))
      .join(", ")}]`
  );
};

console.log(`\n${url}  (${runs} runs)\n`);
console.log(
  `reached completion       ${samples.filter((sample) => sample.reachedCompletion).length}/${samples.length}`
);
report("animation window ms", (sample) => sample.animationMs);
report("median frame ms", (sample) => sample.medianFrameMs);
report("longest frame ms", (sample) => sample.longestFrameMs);
report("dropped frames", (sample) => sample.droppedFrames);
report("long task ms in window", (sample) => sample.longTaskMsInWindow);
report("longest task ms", (sample) => sample.longestTaskInWindowMs);
report("layout shift", (sample) => sample.layoutShift);
report("max height px", (sample) => sample.maxHeight);
console.log("\nwhole mount (navigation to reveal):");
report("longest frame ms", (sample) => sample.mountLongestFrameMs);
report("dropped frames", (sample) => sample.mountDroppedFrames);
report("long task ms", (sample) => sample.mountLongTaskMs);
report("longest task ms", (sample) => sample.mountLongestTaskMs);
console.log("\noffsets from reveal-window start:");
report("longest task at ms", (sample) => sample.longestTaskOffsetMs);
report("last api response at ms", (sample) => sample.lastApiResponseOffsetMs);

// The reveal window opens at first measurable growth, so a task that straddles
// the true animation start sits outside it. Listing tasks either side of the
// boundary is the only way to see whether that task changed.
console.log("\nlong tasks near the reveal boundary (offset ms x duration ms):");
samples.forEach((sample, index) => {
  const nearby = sample.tasksNearBoundary
    .map((task) => `${task.offsetMs.toFixed(0)}x${task.durationMs.toFixed(0)}`)
    .join("  ");
  console.log(`  run ${index + 1}: ${nearby || "(none)"}`);
});
