import { Option, Predicate, Schema } from "effect";
import { YieldPendingActionType } from "../../domain/action/pending-action";
import { ActionId as BorrowActionId, MarketId } from "../../domain/borrow/ids";
import { BorrowPositionActionKey } from "../../domain/borrow/positions/position-action-key";
import { ActionId, YieldId } from "../../domain/identity/identifiers";
import { BalanceDataKey } from "../../domain/portfolio/positions";
import type { WidgetLayout } from "../config/widget-config-model";

/**
 * The Widget's route registry: one definition per route. Every absolute path
 * the Widget renders, navigates to, or matches comes from here; route trees,
 * navigation, and pathname parsing elsewhere use these definitions.
 */

const WidgetPathSchema = Schema.String.pipe(Schema.brand("WidgetPath"));

/** An absolute Widget path, built only by a registry route. */
export type WidgetPath = typeof WidgetPathSchema.Type;

/** A path together with the navigation state its route carries. */
class WidgetLocation<State = unknown> {
  /** Only a registry route builds a location; no runtime field. */
  declare private readonly builtByRoute: never;

  constructor(
    readonly path: WidgetPath,
    readonly state: State
  ) {}
}

/** Where a navigation goes: a path, or a path with its route's state. */
export type WidgetNavigationTarget = WidgetPath | WidgetLocation;

export const widgetTargetPath = (target: WidgetNavigationTarget): WidgetPath =>
  typeof target === "string" ? target : target.path;

export const widgetTargetState = (target: WidgetNavigationTarget): unknown =>
  typeof target === "string" ? undefined : target.state;

const allLayouts = [
  "Compact",
  "Dashboard",
] as const satisfies ReadonlyArray<WidgetLayout>;
/** Layouts wide enough for Borrow and position staking. */
const wideLayouts = [
  "Dashboard",
] as const satisfies ReadonlyArray<WidgetLayout>;

type ParamSchema = Schema.Codec<string, string>;

type ParamNames<Pattern extends string> =
  Pattern extends `${string}:${infer Name}/${infer Rest}`
    ? Name | ParamNames<Rest>
    : Pattern extends `${string}:${infer Name}`
      ? Name
      : never;

type ParamFields<Pattern extends string> = {
  readonly [Name in ParamNames<Pattern>]: ParamSchema;
};

/**
 * A route mounted in only some Layouts takes the Layout it is built for, so
 * navigating to it states which Layout it expects.
 */
type LayoutArgs<Layout extends WidgetLayout> = [WidgetLayout] extends [Layout]
  ? []
  : [layout: Layout];

type ParamArgs<Params> = [keyof Params] extends [never] ? [] : [params: Params];

type WidgetRouteBuildArgs<Layout extends WidgetLayout, Params> = [
  ...LayoutArgs<Layout>,
  ...ParamArgs<Params>,
];

type Segment =
  | Readonly<{ readonly _tag: "Param"; readonly name: string }>
  | Readonly<{ readonly _tag: "Static"; readonly value: string }>;

const parseSegments = (pattern: string): ReadonlyArray<Segment> =>
  pattern
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) =>
      segment.startsWith(":")
        ? { _tag: "Param", name: segment.slice(1) }
        : { _tag: "Static", value: segment.toLowerCase() }
    );

const pathSegments = (pathname: string): ReadonlyArray<string> =>
  pathname.split("/").filter((segment) => segment !== "");

const decodeSegment = (segment: string): Option.Option<string> => {
  try {
    return Option.some(decodeURIComponent(segment));
  } catch {
    return Option.none();
  }
};

/** The params object among a build's arguments; a Layout is a string. */
const findParams = (
  args: ReadonlyArray<unknown>
): Readonly<Record<PropertyKey, unknown>> =>
  args.find(Predicate.isObject) ?? {};

/** True when `pathname` is exactly `path`, ignoring a trailing slash. */
export const isWidgetPath = (pathname: string, path: WidgetPath): boolean =>
  pathSegments(pathname).join("/") === pathSegments(path).join("/");

class WidgetRoute<
  const Pattern extends string,
  Params,
  Layout extends WidgetLayout,
> {
  /** Every path inside this route, for catch-all redirects. */
  readonly descendants: `${Pattern}/*`;
  readonly paramNames: ReadonlyArray<string>;
  readonly #segments: ReadonlyArray<Segment>;

  constructor(
    /** The absolute route pattern route trees mount. */
    readonly pattern: Pattern,
    /** The Layouts whose route trees mount this route. */
    readonly layouts: ReadonlyArray<Layout>,
    /** Decodes the path segments' raw values into the route's params. */
    readonly paramsSchema: Schema.Codec<
      Params,
      Readonly<Record<string, string>>
    >
  ) {
    this.descendants = `${pattern}/*`;
    this.#segments = parseSegments(pattern);
    this.paramNames = this.#segments.flatMap((segment) =>
      segment._tag === "Param" ? [segment.name] : []
    );
  }

  build(...args: WidgetRouteBuildArgs<Layout, Params>): WidgetPath {
    return this.#path(args);
  }

  /**
   * This route's path for `params` in whichever Layout mounts it: it names a
   * mount, not a navigation target, so it needs no Layout.
   */
  mountPath(params: Params): WidgetPath {
    return this.#path([params]);
  }

  #path(args: ReadonlyArray<unknown>): WidgetPath {
    const params = findParams(args);
    const segments = this.#segments.map((segment) => {
      if (segment._tag === "Static") return segment.value;
      const value = params[segment.name];
      return encodeURIComponent(typeof value === "string" ? value : "");
    });
    return WidgetPathSchema.make(`/${segments.join("/")}`);
  }

  /** Binds the navigation state this route's owner carries with its path. */
  withState<State, Encoded>(schema: Schema.Codec<State, Encoded>) {
    return {
      build: (
        state: State,
        ...args: WidgetRouteBuildArgs<Layout, Params>
      ): WidgetLocation<State> =>
        new WidgetLocation(this.build(...args), state),
      state: Schema.decodeUnknownOption(schema),
    };
  }

  /** This route's params when `pathname` is exactly this route. */
  match(pathname: string): Option.Option<Params> {
    return this.#match(pathSegments(pathname), true);
  }

  /** This route's params when `pathname` is this route or inside it. */
  matchPrefix(pathname: string): Option.Option<Params> {
    return this.#match(pathSegments(pathname), false);
  }

  #match(
    segments: ReadonlyArray<string>,
    exact: boolean
  ): Option.Option<Params> {
    if (
      segments.length < this.#segments.length ||
      (exact && segments.length !== this.#segments.length)
    ) {
      return Option.none();
    }
    const params: Record<string, string> = {};
    for (const [index, segment] of this.#segments.entries()) {
      const value = segments[index] ?? "";
      if (segment._tag === "Static") {
        if (value.toLowerCase() !== segment.value) return Option.none();
        continue;
      }
      const decoded = decodeSegment(value);
      if (Option.isNone(decoded)) return Option.none();
      params[segment.name] = decoded.value;
    }
    return Schema.decodeOption(this.paramsSchema)(params);
  }
}

/** One mount's Review, Steps, and Complete paths. */
type WidgetFlowPaths = Readonly<{
  readonly completePath: WidgetPath;
  readonly reviewPath: WidgetPath;
  readonly stepsPath: WidgetPath;
}>;

/** One mount's flow paths, and their locations carrying the flow state. */
export type WidgetFlowDestination<State> = WidgetFlowPaths &
  Readonly<{
    readonly complete: (state: State) => WidgetLocation<State>;
    readonly review: (state: State) => WidgetLocation<State>;
    readonly steps: (state: State) => WidgetLocation<State>;
  }>;

/** The route a flow mounts under, in whichever Layouts mount it. */
type WidgetFlowBase<Params> = Readonly<{
  readonly mountPath: (params: Params) => WidgetPath;
  readonly match: (pathname: string) => Option.Option<Params>;
  readonly paramsSchema: Schema.Codec<Params, Readonly<Record<string, string>>>;
  readonly pattern: string;
}>;

class WidgetFlowRoutes<Params, Layout extends WidgetLayout> {
  constructor(
    /** The route the flow mounts under. */
    readonly base: WidgetFlowBase<Params>,
    readonly review: WidgetRoute<string, Params, Layout>,
    readonly steps: WidgetRoute<string, Params, Layout>,
    readonly complete: WidgetRoute<string, Params, Layout>
  ) {}

  at(...args: WidgetRouteBuildArgs<Layout, Params>): WidgetFlowPaths {
    return {
      completePath: this.complete.build(...args),
      reviewPath: this.review.build(...args),
      stepsPath: this.steps.build(...args),
    };
  }

  /**
   * The base path of the mount a pathname shows, when it is one of this
   * group's pages: its Review, Steps, and Complete share it.
   */
  mountKey(pathname: string): Option.Option<WidgetPath> {
    return Option.firstSomeOf([
      this.review.match(pathname),
      this.steps.match(pathname),
      this.complete.match(pathname),
    ]).pipe(Option.map((params) => this.base.mountPath(params)));
  }

  /** Binds the navigation state the flow's pages carry. */
  withState<State, Encoded>(
    schema: Schema.Codec<State, Encoded>
  ): StatefulWidgetFlowRoutes<Params, Layout, State> {
    return new StatefulWidgetFlowRoutes(
      this,
      Schema.decodeUnknownOption(schema)
    );
  }
}

/** A flow group with the navigation state its owner bound to it. */
class StatefulWidgetFlowRoutes<Params, Layout extends WidgetLayout, State> {
  constructor(
    readonly routes: WidgetFlowRoutes<Params, Layout>,
    /** Decodes a location's state as the flow's state. */
    readonly state: (locationState: unknown) => Option.Option<State>
  ) {}

  at(
    ...args: WidgetRouteBuildArgs<Layout, Params>
  ): WidgetFlowDestination<State> {
    const paths = this.routes.at(...args);
    const located =
      (path: WidgetPath) =>
      (state: State): WidgetLocation<State> =>
        new WidgetLocation(path, state);
    return {
      ...paths,
      complete: located(paths.completePath),
      review: located(paths.reviewPath),
      steps: located(paths.stepsPath),
    };
  }
}

const route = <
  const Pattern extends string,
  Layout extends WidgetLayout,
  const Fields extends Schema.Struct.Fields & ParamFields<Pattern>,
>(
  pattern: Pattern,
  layouts: ReadonlyArray<Layout>,
  fields: Fields
) =>
  new WidgetRoute<Pattern, Schema.Struct<Fields>["Type"], Layout>(
    pattern,
    layouts,
    Schema.Struct(fields)
  );

const flowRoutes = <Params, Layout extends WidgetLayout>(
  base: WidgetFlowBase<Params>,
  layouts: ReadonlyArray<Layout>
) => {
  const prefix = base.pattern === "/" ? "" : base.pattern;
  const page = (name: "complete" | "review" | "steps") =>
    new WidgetRoute<string, Params, Layout>(
      `${prefix}/${name}`,
      layouts,
      base.paramsSchema
    );
  return new WidgetFlowRoutes<Params, Layout>(
    base,
    page("review"),
    page("steps"),
    page("complete")
  );
};

const positionParams = {
  balanceId: BalanceDataKey,
  integrationId: YieldId,
} as const;
const activityActionParams = { actionId: ActionId } as const;
const borrowPositionParams = { marketId: MarketId } as const;

const activityAction = route(
  "/activity/:actionId",
  allLayouts,
  activityActionParams
);

export const widgetRoutes = {
  earn: route("/", allLayouts, {}),
  positions: route("/positions", allLayouts, {}),
  positionDetails: route(
    "/positions/:integrationId/:balanceId",
    allLayouts,
    positionParams
  ),
  positionSelectValidator: route(
    "/positions/:integrationId/:balanceId/select-validator/:pendingActionType",
    allLayouts,
    { ...positionParams, pendingActionType: YieldPendingActionType }
  ),
  /** Base of the stake flow; Compact redirects its paths to the hub. */
  positionStake: route(
    "/positions/:integrationId/:balanceId/stake",
    allLayouts,
    positionParams
  ),
  positionUnstake: route(
    "/positions/:integrationId/:balanceId/unstake",
    allLayouts,
    positionParams
  ),
  positionPendingAction: route(
    "/positions/:integrationId/:balanceId/pending-action",
    allLayouts,
    positionParams
  ),
  activity: route("/activity", allLayouts, {}),
  activityAction,
  activityBorrowAction: route("/activity/borrow/:actionId", allLayouts, {
    actionId: BorrowActionId,
  }),
  borrow: route("/borrow", wideLayouts, {}),
  /** Base of market positions; its unknown paths redirect to Positions. */
  positionsBorrow: route("/positions/borrow", wideLayouts, {}),
  borrowPosition: route(
    "/positions/borrow/:marketId",
    wideLayouts,
    borrowPositionParams
  ),
  borrowPositionAction: route(
    "/positions/borrow/:marketId/action/:actionId",
    wideLayouts,
    { ...borrowPositionParams, actionId: BorrowPositionActionKey }
  ),
} as const;

/** Yield Transaction Flow pages, by the mount that starts them. */
export const widgetYieldFlowRoutes = {
  Earn: flowRoutes(widgetRoutes.earn, allLayouts),
  PositionStake: flowRoutes(widgetRoutes.positionStake, wideLayouts),
  PositionExit: flowRoutes(widgetRoutes.positionUnstake, allLayouts),
  PositionManage: flowRoutes(widgetRoutes.positionPendingAction, allLayouts),
  /** A continuation's Review is the action's own details route. */
  YieldActionContinuation: new WidgetFlowRoutes(
    activityAction,
    activityAction,
    route("/activity/:actionId/steps", allLayouts, activityActionParams),
    route("/activity/:actionId/complete", allLayouts, activityActionParams)
  ),
} as const;

/** Borrow Transaction Flow pages, by the entry that starts them. */
export const widgetBorrowFlowRoutes = {
  BorrowEntry: flowRoutes(widgetRoutes.borrow, wideLayouts),
  MarketPosition: flowRoutes(widgetRoutes.borrowPosition, wideLayouts),
} as const;
