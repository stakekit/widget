import { type ComponentType, lazy, type ReactNode, Suspense } from "react";
import { LoadingSkeleton } from "../loading-skeleton";

/**
 * Splits the `name` export of a module into its own chunk, loaded on first
 * render. Callers pass `() => import("./module")`: a static import would keep
 * the module in the entry chunk. The component shows `fallback` (the
 * page-loading skeleton unless given) while its chunk loads, and carries
 * `name` as its display name.
 */
export const lazyComponent = <
  Name extends string,
  Module extends Readonly<Record<Name, ComponentType<never>>>,
>(
  load: () => Promise<Module>,
  name: Name,
  fallback: ReactNode = <LoadingSkeleton />
): Module[Name] => {
  const Loaded = lazy(async () => {
    // The wrapper below hands this component exactly the props it was given.
    const component = (await load())[name] as ComponentType<object>;
    return { default: component };
  });

  const LazyComponent = (props: object) => (
    <Suspense fallback={fallback}>
      <Loaded {...props} />
    </Suspense>
  );
  LazyComponent.displayName = name;

  // The wrapper forwards every prop, so it takes the props of the export.
  const typed: ComponentType<never> = LazyComponent;
  return typed as Module[Name];
};
