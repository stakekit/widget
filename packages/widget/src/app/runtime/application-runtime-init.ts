import * as Atom from "effect/unstable/reactivity/Atom";
import type { RouteObject } from "react-router";
import type { SKHostConfiguration } from "../../public-api/types";

export type ApplicationRuntimeInit = Readonly<{
  hostConfiguration: SKHostConfiguration;
  isLedgerLive: boolean;
  routes: ReadonlyArray<RouteObject>;
}>;

export const applicationRuntimeInitAtom =
  Atom.make<ApplicationRuntimeInit | null>(null).pipe(
    Atom.withLabel("applicationRuntimeInitAtom")
  );
