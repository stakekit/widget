/**
 * Smoke-tests the built widget the way a host app consumes it.
 *
 * Widget unit/DOM/browser tests import `src/`. Failures such as a host
 * rebundling `dist/package`, a missing `dist` file, or a TDZ/module-eval crash
 * only show up after `build:package` / `build:bundle` / `build:types`. This
 * script is that missing check: it asserts example apps resolve
 * `@stakekit/widget` (and `./bundle`) into `packages/widget/dist`, builds those
 * hosts, then loads Vite preview, `next start`, the static Angular build and
 * the Angular dev server in Chromium. The dev server excludes the widget from
 * pre-bundling, so Angular's esbuild bundles `dist` itself, as hosts that
 * exclude the widget from pre-bundling do.
 *
 * Green means the widget shell mounted and a catalog-backed control appeared
 * against a live API, with no `pageerror` and no fatal console errors (TDZ,
 * missing modules, chunk load, minified React). It is not a journey test.
 *
 * Run via `pnpm test:smoke`. Requires `VITE_API_KEY` or `NEXT_PUBLIC_API_KEY`
 * (or an example env file). Not part of `check`, `test`, or `test:changed`.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { access, readdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { join, relative, sep } from "node:path";
import type { Readable } from "node:stream";
import { type Browser, chromium, type Page } from "playwright";
import { repositoryRoot, widgetRoot } from "../paths";

type Host = {
  readonly label: string;
  readonly packageName: string;
  readonly directory: string;
  readonly widgetSpecifiers: ReadonlyArray<string>;
};

const hosts = {
  vitePackage: {
    label: "Vite package entry",
    packageName: "@stakekit/with-vite",
    directory: join(repositoryRoot, "packages/examples/with-vite"),
    widgetSpecifiers: ["@stakekit/widget"],
  },
  viteBundle: {
    label: "Vite bundle entry",
    packageName: "@stakekit/with-vite-bundled",
    directory: join(repositoryRoot, "packages/examples/with-vite-bundled"),
    widgetSpecifiers: ["@stakekit/widget/bundle"],
  },
  next: {
    label: "Next.js",
    packageName: "@stakekit/with-nextjs",
    directory: join(repositoryRoot, "packages/examples/with-nextjs"),
    widgetSpecifiers: ["@stakekit/widget"],
  },
  angular: {
    label: "Angular bundle entry",
    packageName: "@stakekit/with-angular",
    directory: join(repositoryRoot, "packages/examples/with-angular"),
    widgetSpecifiers: ["@stakekit/widget/bundle"],
  },
} as const satisfies Record<string, Host>;

const envFileNames = [
  ".env.production.local",
  ".env.development.local",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env",
] as const;

const fatalConsolePatterns = [
  /\bCannot access ['"].+['"] before initialization\b/i,
  /\bReferenceError:.*before initialization\b/i,
  /\bCannot find module\b/i,
  /\bModule not found\b/i,
  /\bFailed to resolve (?:module|import)\b/i,
  /\bFailed to resolve module specifier\b/i,
  /\bFailed to fetch dynamically imported module\b/i,
  /\b(?:Importing|Loading) (?:a )?module script failed\b/i,
  /\bdoes not provide an export named\b/i,
  /\bChunkLoadError\b/i,
  /\bLoading chunk \S+ failed\b/i,
  /\bMinified React error #\d+\b/i,
  /\bInvalid hook call\b/i,
];

type ProcessEnv = Record<string, string | undefined>;

type RunningServer = {
  readonly boundUrl: Promise<string>;
  readonly child: ChildProcess;
  readonly exit: Promise<{
    readonly code: number | null;
    readonly signal: string | null;
  }>;
  readonly label: string;
};

const runningServers = new Set<RunningServer>();

// Every host server announces the port it actually bound, which is the only
// trustworthy value: a free port can be taken between reservation and bind.
const announcedUrlPattern =
  /\bhttps?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)\b/u;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });

const hasErrorCode = (error: unknown): error is { readonly code: string } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string";

const assertHostsResolveBuiltWidget = () => {
  const distRoot = join(widgetRoot, "dist");

  for (const host of Object.values(hosts)) {
    const requireFromHost = createRequire(join(host.directory, "package.json"));

    for (const specifier of host.widgetSpecifiers) {
      const resolved = requireFromHost.resolve(specifier);
      if (!resolved.startsWith(`${distRoot}${sep}`)) {
        throw new Error(
          `${host.label} resolves ${specifier} to ${resolved} instead of packages/widget/dist`
        );
      }

      console.log(
        `[smoke] ${host.label} resolves ${specifier} to ${relative(repositoryRoot, resolved)}`
      );
    }
  }
};

// An external import only shares React's work queue when the consumer resolves
// it to the renderer's scheduler. Equal version ranges alone do not ensure this.
const assertSharedScheduler = () => {
  const widgetRequire = createRequire(join(widgetRoot, "package.json"));
  const widgetScheduler = widgetRequire.resolve("scheduler");
  for (const host of [hosts.vitePackage, hosts.next]) {
    const hostRequire = createRequire(join(host.directory, "package.json"));
    const rendererRequire = createRequire(hostRequire.resolve("react-dom"));
    const rendererScheduler = rendererRequire.resolve("scheduler");
    if (widgetScheduler !== rendererScheduler) {
      throw new Error(
        `${host.label} resolves a different scheduler from the widget. Align scheduler with react-dom before publishing. Widget: ${widgetScheduler}; renderer: ${rendererScheduler}`
      );
    }
    console.log(
      `[smoke] ${host.label} resolves the same scheduler as the widget`
    );
  }
};

const assertBuiltWidgetArtifacts = async () => {
  const artifactPaths = [
    "dist/package/index.package.js",
    "dist/package/index.package.css",
    "dist/bundle/index.bundle.js",
    "dist/types/index.package.d.ts",
    "dist/types/index.bundle.d.ts",
  ] as const;

  await Promise.all(
    artifactPaths.map(async (path) => {
      try {
        await access(join(widgetRoot, path));
      } catch {
        throw new Error(
          `Built widget artifact is missing: packages/widget/${path}`
        );
      }
    })
  );
};

// Turbopack chunks cannot be imported on their own, so for Next.js the smoke
// test checks the build output: the widget only starts the worker from the
// copy Next serves.
const assertNextCopiesEncryptWorker = async () => {
  const directory = ".next/static/media";
  const files = await readdir(join(hosts.next.directory, directory));
  if (!files.some((file) => /^encrypt\.worker-.+\.js$/u.test(file))) {
    throw new Error(
      `${hosts.next.label} build did not copy the Zama encrypt worker into ${directory}`
    );
  }
  console.log(`[smoke] ${hosts.next.label} copies the Zama encrypt worker`);
};

type EncryptWorkerExpectation = {
  /** Host output directory that holds the widget's chunks. */
  readonly directory: string;
  /** URL path the host serves that directory under. */
  readonly urlPath: string;
  /** Where the widget must start the Zama encrypt worker in this host. */
  readonly source: "host copy" | "inline copy";
};

const findChunk = async (
  directory: string,
  description: string,
  matches: (code: string) => boolean
) => {
  for (const file of await readdir(directory)) {
    if (!file.endsWith(".js")) continue;
    const code = await readFile(join(directory, file), "utf8");
    if (matches(code)) return { code, file };
  }
  throw new Error(`No ${description} chunk in ${directory}`);
};

const workerScriptPattern =
  /new URL\(\s*(["'`])([^"'`]*encrypt\.worker[^"'`]*\.js)\1/u;

// Resolves the worker the widget would start in this host from the host's own
// build: the copy its loader chunk points at, or the inlined Blob worker. The
// widget's choice between them is covered by its unit tests.
const encryptWorkerTarget = async (expectation: EncryptWorkerExpectation) => {
  if (expectation.source === "inline copy") {
    const { file } = await findChunk(
      expectation.directory,
      "inline Zama encrypt worker",
      (code) =>
        code.includes("createObjectURL") &&
        code.includes("zama-encrypt-worker-ready")
    );
    return { chunk: `${expectation.urlPath}${file}`, script: null };
  }
  const { code, file } = await findChunk(
    expectation.directory,
    "Zama encrypt worker loader",
    (code) => /\bas loadEncryptWorker\b/u.test(code)
  );
  const script = code.match(workerScriptPattern)?.[2];
  if (!script) {
    throw new Error(`${file} does not reference the Zama encrypt worker`);
  }
  return { chunk: `${expectation.urlPath}${file}`, script };
};

// Starts the worker the way the Zama SDK does, so a host that stops serving
// the copy, or a broken inline fallback, fails here instead of silently
// encrypting on the page's main thread.
const assertEncryptWorkerStarts = async (
  page: Page,
  label: string,
  expectation: EncryptWorkerExpectation
) => {
  const target = await encryptWorkerTarget(expectation);
  // No named function bindings in here: tsx would wrap them in a `__name`
  // helper that does not exist in the page.
  const state = await page.evaluate(async ({ chunk, script }) => {
    const scriptUrl =
      script === null
        ? null
        : new URL(script, new URL(chunk, location.href)).href;
    if (scriptUrl !== null) {
      const head = await fetch(scriptUrl, { method: "HEAD" });
      const contentType = head.headers.get("content-type") ?? "";
      if (!head.ok || !/javascript/u.test(contentType)) {
        return `${scriptUrl} answered ${head.status} ${contentType}`;
      }
    }
    const inlineChunk: unknown =
      scriptUrl === null ? await import(chunk) : undefined;
    const InlineWorker =
      typeof inlineChunk === "object" &&
      inlineChunk !== null &&
      "default" in inlineChunk &&
      typeof inlineChunk.default === "function"
        ? // Vite's `?worker&inline` default export is a Worker constructor.
          (inlineChunk.default as new (options: {
            name: string;
          }) => Worker)
        : undefined;
    if (scriptUrl === null && InlineWorker === undefined) {
      return `${chunk} does not export an inline worker constructor`;
    }
    const worker = InlineWorker
      ? new InlineWorker({ name: "zama-fhe-encrypt" })
      : new Worker(scriptUrl!, { name: "zama-fhe-encrypt", type: "module" });
    const { promise, resolve } = Promise.withResolvers<string>();
    worker.addEventListener("message", (event) => {
      if (event.data === "zama-encrypt-worker-ready") resolve("ready");
    });
    worker.addEventListener("error", (event) => {
      resolve(`error: ${event.message}`);
    });
    setTimeout(() => resolve("timed out"), 30_000);
    const result = await promise;
    worker.terminate();
    return result;
  }, target);

  if (state !== "ready") {
    throw new Error(
      `${label} Zama encrypt worker (${expectation.source}) did not start: ${state}`
    );
  }
  console.log(
    `[smoke] ${label} starts the Zama encrypt worker from the ${expectation.source}`
  );
};

const parseEnvValue = (contents: string, variableName: string) => {
  for (const line of contents.split(/\r?\n/u)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u
    );
    if (!match || match[1] !== variableName) {
      continue;
    }

    const rawValue = match[2]?.trim() ?? "";
    const quote = rawValue.at(0);
    if ((quote === '"' || quote === "'") && rawValue.at(-1) === quote) {
      return rawValue.slice(1, -1).trim();
    }

    return rawValue.replace(/\s+#.*$/u, "").trim();
  }

  return "";
};

const readEnvCandidate = async (path: string, variableName: string) => {
  try {
    const contents = await readFile(path, "utf8");
    return parseEnvValue(contents, variableName);
  } catch (error) {
    if (hasErrorCode(error) && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
};

const reportApiKeySource = (source: string) => {
  console.log(`[smoke] Using StakeKit API key from ${source}`);
};

const resolveApiKey = async () => {
  const processCandidates = [
    ["VITE_API_KEY", process.env.VITE_API_KEY],
    ["NEXT_PUBLIC_API_KEY", process.env.NEXT_PUBLIC_API_KEY],
  ] as const;

  for (const [source, value] of processCandidates) {
    const trimmed = value?.trim();
    if (trimmed) {
      reportApiKeySource(`environment variable ${source}`);
      return trimmed;
    }
  }

  for (const host of Object.values(hosts)) {
    for (const fileName of envFileNames) {
      const path = join(host.directory, fileName);
      for (const variableName of ["VITE_API_KEY", "NEXT_PUBLIC_API_KEY"]) {
        const value = await readEnvCandidate(path, variableName);
        if (value) {
          reportApiKeySource(
            `${path.slice(repositoryRoot.length + 1)} (${variableName})`
          );
          return value;
        }
      }
    }
  }

  throw new Error(
    [
      "Production-consumer smoke test requires a non-empty StakeKit API key.",
      "Set VITE_API_KEY or NEXT_PUBLIC_API_KEY, or add one to an example .env file.",
      "The resolved value is passed to every host as both variables.",
    ].join(" ")
  );
};

const runCommand = async (
  label: string,
  args: ReadonlyArray<string>,
  env: ProcessEnv
) => {
  console.log(`\n[smoke] ${label}`);
  const child = spawn("pnpm", [...args], {
    cwd: repositoryRoot,
    env,
    stdio: "inherit",
  });
  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(
      `${label} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`
    );
  }
};

const getFreePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a smoke-test port"));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });

const pipeServerOutput = (
  stream: Readable,
  label: string,
  onLine: (line: string) => void
) => {
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    for (const line of chunk.trimEnd().split(/\r?\n/u)) {
      if (line) {
        console.log(`[${label}] ${line}`);
        onLine(line);
      }
    }
  });
};

const startServer = ({
  label,
  args,
  env,
}: {
  readonly label: string;
  readonly args: ReadonlyArray<string>;
  readonly env: ProcessEnv;
}): RunningServer => {
  const child = spawn("pnpm", [...args], {
    cwd: repositoryRoot,
    detached: process.platform !== "win32",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let announceBoundUrl!: (url: string) => void;
  const boundUrl = new Promise<string>((resolve) => {
    announceBoundUrl = resolve;
  });
  const handleLine = (line: string) => {
    const match = line.match(announcedUrlPattern);
    const port = match?.[1];
    if (port) {
      announceBoundUrl(`http://127.0.0.1:${port}`);
    }
  };

  if (!child.stdout || !child.stderr) {
    throw new Error(`${label} did not expose stdout and stderr pipes`);
  }

  pipeServerOutput(child.stdout, label, handleLine);
  pipeServerOutput(child.stderr, label, handleLine);

  const exit = once(child, "exit").then(([code, signal]) => ({
    code: typeof code === "number" ? code : null,
    signal: typeof signal === "string" ? signal : null,
  }));
  const server = { boundUrl, child, exit, label };
  runningServers.add(server);
  return server;
};

const stopServer = async (server: RunningServer) => {
  if (!runningServers.delete(server) || server.child.exitCode !== null) {
    return;
  }

  const pid = server.child.pid;
  if (pid === undefined) {
    await server.exit;
    return;
  }

  const target = process.platform === "win32" ? pid : -pid;
  try {
    process.kill(target, "SIGTERM");
  } catch (error) {
    if (!hasErrorCode(error) || error.code !== "ESRCH") {
      throw error;
    }
  }

  const stopped = await Promise.race([
    server.exit.then(() => true),
    delay(5_000).then(() => false),
  ]);
  if (stopped) {
    return;
  }

  try {
    process.kill(target, "SIGKILL");
  } catch (error) {
    if (!hasErrorCode(error) || error.code !== "ESRCH") {
      throw error;
    }
  }
  await server.exit;
};

const stopAllServers = async () => {
  await Promise.all([...runningServers].map(stopServer));
};

const resolveBoundUrl = async (
  server: RunningServer,
  requestedPort: number,
  timeoutMs = 120_000
) => {
  const result = await Promise.race([
    server.boundUrl.then((url) => ({ url }) as const),
    server.exit.then(({ code, signal }) => ({
      exitedWith: signal ?? code,
    })),
    delay(timeoutMs).then(() => ({ timedOut: true }) as const),
  ]);

  if ("exitedWith" in result) {
    throw new Error(
      `${server.label} exited before announcing a URL (${result.exitedWith})`
    );
  }
  if ("timedOut" in result) {
    throw new Error(
      `${server.label} did not announce a listening URL within ${timeoutMs}ms`
    );
  }

  const boundPort = Number(new URL(result.url).port);
  if (boundPort !== requestedPort) {
    console.log(
      `[smoke] ${server.label} bound port ${boundPort} instead of the requested ${requestedPort}; targeting the announced port`
    );
  }

  return result.url;
};

const waitForServer = async (
  server: RunningServer,
  url: string,
  timeoutMs = 120_000
) => {
  const deadline = Date.now() + timeoutMs;
  let lastFailure = "no response yet";

  while (Date.now() < deadline) {
    const attemptBudgetMs = Math.max(1, Math.min(5_000, deadline - Date.now()));
    const result = await Promise.race([
      server.exit.then(({ code, signal }) => ({
        exited: true as const,
        message: `${server.label} exited before becoming ready (${signal ?? code})`,
      })),
      fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(attemptBudgetMs),
      })
        .then(() => ({ ready: true as const }))
        .catch((error: unknown) => ({
          ready: false as const,
          failure: error instanceof Error ? error.message : String(error),
        })),
    ]);

    if ("exited" in result) {
      throw new Error(result.message);
    }
    if (result.ready) {
      return;
    }

    lastFailure = result.failure ?? lastFailure;
    await delay(250);
  }

  throw new Error(
    `${server.label} was not ready at ${url} within ${timeoutMs}ms (last failure: ${lastFailure})`
  );
};

const assertWidgetLoads = async (
  browser: Browser,
  label: string,
  url: string,
  encryptWorker: EncryptWorkerExpectation | undefined
) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors: Array<string> = [];
  const fatalConsoleErrors: Array<string> = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.stack ?? error.message);
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      fatalConsolePatterns.some((pattern) => pattern.test(message.text()))
    ) {
      const location = message.location();
      fatalConsoleErrors.push(
        `${message.text()}${location.url ? ` (${location.url}:${location.lineNumber})` : ""}`
      );
    }
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page
      .locator('[data-rk="widget-container"]')
      .waitFor({ state: "visible", timeout: 90_000 });
    await page
      .locator(
        '[data-rk="earn-live-presentation"] [data-testid="select-token"]'
      )
      .waitFor({ state: "visible", timeout: 90_000 });
    await page.waitForTimeout(500);
    if (encryptWorker) {
      await assertEncryptWorkerStarts(page, label, encryptWorker);
    }

    if (pageErrors.length > 0 || fatalConsoleErrors.length > 0) {
      const failures = [
        ...pageErrors.map((error) => `pageerror: ${error}`),
        ...fatalConsoleErrors.map((error) => `fatal console error: ${error}`),
      ];
      throw new Error(`${label} browser failures:\n${failures.join("\n")}`);
    }
    console.log(`[smoke] PASS ${label}`);
  } finally {
    await context.close();
  }
};

const withServer = async ({
  browser,
  label,
  args,
  env,
  encryptWorker,
}: {
  readonly browser: Browser;
  readonly label: string;
  readonly args: (port: number) => ReadonlyArray<string>;
  readonly env: ProcessEnv;
  readonly encryptWorker?: EncryptWorkerExpectation;
}) => {
  const port = await getFreePort();
  const server = startServer({ label, args: args(port), env });

  try {
    const url = await resolveBoundUrl(server, port);
    await waitForServer(server, url);
    await assertWidgetLoads(browser, label, url, encryptWorker);
  } finally {
    await stopServer(server);
  }
};

const main = async () => {
  assertSharedScheduler();
  if (process.argv.includes("--check-dependencies")) {
    return;
  }
  const apiKey = await resolveApiKey();

  if (process.argv.includes("--check-key")) {
    return;
  }

  const env = {
    ...process.env,
    VITE_API_KEY: apiKey,
    NEXT_PUBLIC_API_KEY: apiKey,
  };

  await assertBuiltWidgetArtifacts();
  assertHostsResolveBuiltWidget();

  await runCommand(
    `${hosts.vitePackage.label} build`,
    ["--filter", hosts.vitePackage.packageName, "run", "build"],
    env
  );
  await runCommand(
    `${hosts.viteBundle.label} build`,
    ["--filter", hosts.viteBundle.packageName, "run", "build"],
    env
  );
  await runCommand(
    `${hosts.next.label} production build`,
    ["--filter", hosts.next.packageName, "run", "build"],
    env
  );
  // Angular caches build and pre-bundle output across runs; start clean so the
  // Angular stages consume this run's `dist`.
  await rm(join(hosts.angular.directory, ".angular"), {
    force: true,
    recursive: true,
  });
  await runCommand(
    `${hosts.angular.label} production build`,
    ["--filter", hosts.angular.packageName, "run", "build"],
    env
  );
  await assertNextCopiesEncryptWorker();

  const browser = await chromium.launch();

  try {
    await withServer({
      browser,
      label: hosts.vitePackage.label,
      env,
      encryptWorker: {
        directory: join(hosts.vitePackage.directory, "dist/assets"),
        urlPath: "/assets/",
        source: "host copy",
      },
      args: (port) => [
        "--filter",
        hosts.vitePackage.packageName,
        "exec",
        "vite",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--strictPort",
      ],
    });
    await withServer({
      browser,
      label: hosts.viteBundle.label,
      env,
      encryptWorker: {
        directory: join(hosts.viteBundle.directory, "dist/assets"),
        urlPath: "/assets/",
        source: "host copy",
      },
      args: (port) => [
        "--filter",
        hosts.viteBundle.packageName,
        "exec",
        "vite",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--strictPort",
      ],
    });
    await withServer({
      browser,
      label: `${hosts.next.label} production`,
      env,
      args: (port) => [
        "--filter",
        hosts.next.packageName,
        "exec",
        "next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
    });
    await withServer({
      browser,
      label: `${hosts.angular.label} production`,
      env,
      encryptWorker: {
        directory: join(hosts.angular.directory, "dist/browser"),
        urlPath: "/",
        source: "inline copy",
      },
      args: (port) => [
        "--filter",
        hosts.angular.packageName,
        "exec",
        "serve",
        "--no-clipboard",
        "--listen",
        `tcp://127.0.0.1:${port}`,
        "dist/browser",
      ],
    });
    await withServer({
      browser,
      label: `${hosts.angular.label} dev server`,
      env,
      args: (port) => [
        "--filter",
        hosts.angular.packageName,
        "exec",
        "ng",
        "serve",
        "--define",
        `SK_API_KEY=${JSON.stringify(apiKey)}`,
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ],
    });
  } finally {
    await browser.close();
  }
};

const handleSignal = (signal: "SIGINT" | "SIGTERM") => {
  void stopAllServers().finally(() => {
    process.kill(process.pid, signal);
  });
};

process.once("SIGINT", () => handleSignal("SIGINT"));
process.once("SIGTERM", () => handleSignal("SIGTERM"));

const run = async () => {
  try {
    await main();
  } catch (error) {
    console.error(
      `[smoke] FAIL ${error instanceof Error ? (error.stack ?? error.message) : error}`
    );
    process.exitCode = 1;
  } finally {
    await stopAllServers();
  }
};

void run();
