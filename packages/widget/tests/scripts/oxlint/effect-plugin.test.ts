import plugin from "../../../scripts/oxlint/effect-plugin";
import { ruleRunner, widget } from "./rule-tester";

const source = `${widget}src/features/earn/state/page.ts`;
const test = `${widget}tests/features/earn/page.test.ts`;
const generated = `${widget}src/generated/api/yield.ts`;

const run = ruleRunner(plugin.rules);

run("no-ad-hoc-atom-runtime", {
  filename: source,
  message:
    "Widget runtimes are built in src/runtime, or assembled in src/app/runtime.",
  valid: ["appRuntime.atom(program)", "walletRuntime.fn(program)"],
  invalid: ["Atom.runtime(layer)"],
  outOfScope: [
    `${widget}src/runtime/wallet-runtime.ts`,
    `${widget}src/app/runtime/color-scheme-runtime.ts`,
    generated,
    test,
  ],
});

run("no-async-result-in-feature-ui", {
  filename: `${widget}src/features/earn/ui/page.tsx`,
  message:
    "Feature UI presents view states, never raw async results. Publish a Presentable (shared/effect/async-result) or a plain value from the feature's state read model.",
  valid: [
    'import { toPresentable } from "../../../shared/effect/async-result"',
    'import type { Presentable } from "../../../shared/effect/async-result"',
    'import { useAtomValue } from "@effect/atom-react"',
    'const specifier = "effect/reactivity/AsyncResult"',
  ],
  invalid: [
    'import * as AsyncResult from "effect/reactivity/AsyncResult"',
    'import type * as AsyncResult from "effect/reactivity/AsyncResult"',
    'import type { AsyncResult } from "effect/reactivity/AsyncResult"',
    "import { getOrElse } from 'effect/reactivity/AsyncResult'",
    'export { isFailure } from "effect/reactivity/AsyncResult"',
  ],
  outOfScope: [source],
});

run("no-default-atom-idle-ttl", {
  filename: `${widget}src/app/providers/registry.tsx`,
  message:
    "The application Atom registry must use native immediate disposal without a default idle TTL.",
  valid: [
    "AtomRegistry.make({ timeoutResolution: 1 })",
    "<RegistryProvider>{children}</RegistryProvider>",
    "const defaultIdleTTL = 1",
  ],
  invalid: [
    "AtomRegistry.make({ defaultIdleTTL: 300_000 })",
    "<RegistryProvider defaultIdleTTL={300_000}>{children}</RegistryProvider>",
    '<RegistryProvider defaultIdleTTL="300000">{children}</RegistryProvider>',
    "<RegistryProvider defaultIdleTTL={300_000} />",
    "registry.defaultIdleTTL",
  ],
  outOfScope: ["/repo/packages/website/src/registry.tsx"],
});

run("no-direct-atom-idle-ttl", {
  filename: source,
  message:
    "Atom retention is transient by default; only the shared API resource policy may configure a finite idle TTL.",
  valid: [
    "Atom.keepAlive(atom)",
    "withApiResourcePolicy({ staleTime: Duration.minutes(1) })",
  ],
  invalid: ["Atom.setIdleTTL(0)", "Atom.setIdleTTL(Duration.minutes(5))"],
  outOfScope: [`${widget}src/shared/effect/api-resource.ts`],
});

run("no-direct-atom-lifecycle-in-features", {
  filename: source,
  message:
    "Feature modules must use the shared app-runtime lifecycle adapters instead of accessing Atom registry lifecycle operations directly.",
  valid: [
    "atomToStream(context, stateAtom)",
    "context.set(stateAtom, value)",
    "context.mount(stateAtom, extra)",
    "const mount = context.mount",
  ],
  invalid: [
    "context.registry",
    "get.registry",
    "ctx.registry",
    "atomContext.registry",
    "context.mount(stateAtom)",
    "get.mount(stateAtom)",
    "ctx.mount(stateAtom)",
    "atomContext.mount(stateAtom)",
    "context.subscribe(stateAtom, listener)",
    "get.subscribe(stateAtom, listener)",
    "ctx.subscribe(stateAtom, listener)",
    "fnContext.subscribe(stateAtom, listener)",
  ],
  outOfScope: [`${widget}src/shared/effect/atom.ts`],
});

run("no-direct-effect-runtime-execution", {
  filename: source,
  message:
    "Run Effects through the scoped Atom runtime or an injected scoped runner.",
  valid: [
    "runWalletEffect(program)",
    "appRuntime.atom(program)",
    "FiberSet.makeRuntimePromise()",
    "const run = Effect.runPromise",
  ],
  invalid: [
    "Effect.runPromise(program)",
    "Effect.runPromiseWith(context)(program)",
    "Effect.runFork(program)",
    "Effect.runSync(program)",
    "Effect.runCallback(program)",
  ],
  outOfScope: [generated, test],
});

run("no-effect-atom-in-feature-logic", {
  filename: `${widget}src/features/earn/model/page.ts`,
  message: "Feature models must stay independent of Effect Atom.",
  valid: [
    'import { Effect } from "effect"',
    'import type { YieldAction } from "../../../domain/schema/action-models"',
  ],
  invalid: [
    'import * as Atom from "effect/reactivity/Atom"',
    'import * as AtomRegistry from "effect/reactivity/AtomRegistry"',
  ],
  outOfScope: [source],
});

run("no-literal-effect-failure", {
  filename: source,
  message: "Pass a tagged domain error to Effect.fail.",
  valid: [
    'Effect.fail(new AppError({ message: "boom" }))',
    "Effect.fail(error)",
    'Effect.fail({ _tag: "AppError", message: "boom" })',
  ],
  invalid: [
    'Effect.fail("boom")',
    "Effect.fail(42)",
    "Effect.fail(false)",
    "Effect.fail(null)",
    "Effect.fail(undefined)",
    "Effect.fail(`failed: ${reason}`)",
    'Effect.fail({ message: "boom" })',
    'Effect.fail(["boom"])',
  ],
  outOfScope: [generated, test],
});

run("no-native-date", {
  filename: source,
  message:
    "Use Effect DateTime at application boundaries instead of native Date.",
  valid: [
    "const now = yield* DateTime.now",
    "const timestamp: DateTime.Utc = DateTime.makeUnsafe(input)",
    "const date = DateTime.toEpochMillis(timestamp)",
    "const schema = Schema.DateTimeUtcFromString",
    "const fields = { Date: 1 }",
  ],
  invalid: [
    "const now = new Date()",
    "const timestamp: Date = input",
    "const parsed = Date.parse(input)",
    "const parsed = window.Date.parse(input)",
    "const parsed = globalThis.Date.parse(input)",
    "const value = DateTime.toDate(timestamp)",
    "const value = DateTime.toDateUtc(timestamp)",
    "const schema = Schema.DateFromString",
    "const schema = Schema.DateTimeUtcFromDate",
  ],
  outOfScope: [generated, `${widget}tests/generated/api.ts`],
});

run("no-native-effect-failure", {
  filename: source,
  message: "Map expected Effect failures to a tagged domain error.",
  valid: [
    'Effect.fail(new AppError({ message: "boom" }))',
    "Effect.tryPromise({ try: load, catch: cause => new AppError({ cause }) })",
    "Effect.mapError(cause => new AppError({ cause }))",
    'throw new Error("third-party callback contract")',
  ],
  invalid: [
    'Effect.fail(new Error("boom"))',
    'Effect.fail(TypeError("boom"))',
    'Effect.fail(new globalThis.RangeError("boom"))',
    'Effect.mapError(cause => new Error("boom", { cause }))',
    'Effect.try({ try: load, catch: cause => new Error("boom", { cause }) })',
    'Effect.tryPromise({ try: load, catch: (cause) => new TypeError("boom", { cause }) })',
  ],
  outOfScope: [generated, test],
});

run("no-run-effect-in-test", {
  filename: test,
  message:
    "Return Effect test programs from it.effect or it.live; run Effects directly only at documented non-Effect boundaries.",
  valid: [
    'it.effect("uses Effect", () => program)',
    'it.live("uses live services", () => program)',
    "const runWalletEffect = runtime.runPromise",
  ],
  invalid: [
    'it("runs an Effect", async () => await Effect.runPromise(program))',
    "const decode = () => Effect.runSync(program)",
    "const exit = Effect.runPromiseExit(program)",
    "const fiber = Effect.runFork(program)",
    "const cancel = Effect.runCallback(program)",
    "const run = Effect.runPromiseWith(context)",
  ],
  outOfScope: [source],
});

run("no-runtime-provide-service", {
  filename: source,
  message:
    "Resolve static Effect dependencies during Layer construction instead of locally re-providing a captured service while an operation runs.",
  valid: [
    "Layer.provide(WalletOperations.layer)",
    "const operations = yield* WalletOperations",
    "yield* operation",
  ],
  invalid: [
    "operation.pipe(Effect.provideService(WalletOperations, operations))",
    "Effect.provideService(operation, WalletOperations, operations)",
  ],
  outOfScope: [generated, test],
});

run("no-throw-in-effect-generator", {
  filename: source,
  message: "Use yield* for expected failures or Effect.die for defects.",
  valid: [
    'Effect.gen(function* () { yield* new AppError({ message: "boom" }) })',
    'Effect.fn("program")(function* () { yield* Effect.die("boom") })',
    'Effect.gen(function* () { yield* Effect.try({ try: () => { throw new AppError({ message: "boom" }) }, catch: cause => new AppError({ cause }) }) })',
    'const plain = () => { throw new AppError({ message: "boom" }) }',
    'const generator = function* () { throw new AppError({ message: "boom" }) }',
  ],
  invalid: [
    'Effect.gen(function* () { throw new AppError({ message: "boom" }) })',
    'Effect.fn("program")(function* () { if (bad) throw new AppError({ message: "boom" }) })',
  ],
  outOfScope: [generated, test],
});

run("no-unknown-async-result-failure", {
  filename: source,
  message:
    "Use a tagged domain error in the AsyncResult failure channel instead of unknown.",
  valid: [
    "const x: AsyncResult.AsyncResult<string, ApiReadFailure> = null as never",
    "const x: AsyncResult.AsyncResult<string, never> = null as never",
  ],
  invalid: [
    "const x: AsyncResult.AsyncResult<string, unknown> = null as never",
  ],
  outOfScope: [generated, test],
});

run("no-unknown-effect-failure", {
  filename: source,
  message:
    "Use a tagged domain error in the Effect failure channel instead of unknown.",
  valid: [
    "const x: Effect.Effect<string, ApiReadFailure> = null as never",
    "const x: Effect.Effect<string, ApiReadFailure, Scope.Scope> = null as never",
    "function f(): Effect.fn.Return<void, WidgetNavigationError, never> { return undefined as never }",
    "const x: Effect.Effect<string> = null as never",
  ],
  invalid: [
    "const x: Effect.Effect<string, unknown> = null as never",
    "const x: Effect.Effect<string, unknown, never> = null as never",
    "function f(): Effect.fn.Return<void, unknown, never> { return undefined as never }",
    "const claimAfter = (operation: () => Effect.Effect<boolean, unknown, never>) => operation",
  ],
  outOfScope: [generated, test],
});

run("no-unsafe-date-time", {
  filename: source,
  message:
    "Use Effect Clock or DateTime.now; unsafe wall-clock access is reserved for the synchronous WalletConnect adapter.",
  valid: [
    "const now = yield* DateTime.now",
    "const now = yield* Clock.currentTimeMillis",
    "const elapsed = DateTime.distance(start, end)",
  ],
  invalid: [
    "const now = DateTime.nowUnsafe()",
    "const expired = DateTime.isPastUnsafe(timestamp)",
    "const scheduled = DateTime.isFutureUnsafe(timestamp)",
  ],
  outOfScope: [generated, `${widget}tests/generated/api.ts`],
});

run("presentable-resource-sources", {
  filename: `${widget}src/resources/yields/yields.ts`,
  message:
    "A Resource that reads an API ResourceSource must publish it through makePresentableResource or makePresentableResourceFamily, so failures are presented only while a foreground observer is mounted.",
  valid: [
    `import { YieldResourceSource } from "../../services/api/resource-sources";
import { makePresentableResource } from "../resource-failure-presentation";
export const yieldsAtom = makePresentableResource(
  YieldResourceSource.use((source) => source.yields)
);`,
    `import { LegacyResourceSource } from "../../services/api/resource-sources";
import { makePresentableResourceFamily } from "../resource-failure-presentation";
export const pricesAtom = makePresentableResourceFamily(
  (key) => LegacyResourceSource.use((source) => source.prices(key))
);`,
    'import { exactDecimal } from "../../domain/finance/exact";',
  ],
  invalid: [
    `import { YieldResourceSource } from "../../services/api/resource-sources";
export const yieldsAtom = runtime.atom(
  YieldResourceSource.use((source) => source.yields)
);`,
    `import { BorrowResourceSource, LegacyResourceSource } from "../../services/api/resource-sources";
export const marketsAtom = runtime.atom(BorrowResourceSource.use((source) => source.markets));`,
  ],
  outOfScope: [source],
});
