import * as Atom from "effect/unstable/reactivity/Atom";
import type { RouteObject } from "react-router";
import type { SKAppProps } from "../../public-api/types";

export type ApplicationRuntimeInit = Readonly<{
  hostConfiguration: SKAppProps;
  isLedgerLive: boolean;
  routes: ReadonlyArray<RouteObject>;
}>;

export const applicationRuntimeInitAtom =
  Atom.make<ApplicationRuntimeInit | null>(null).pipe(
    Atom.withLabel("applicationRuntimeInitAtom")
  );
