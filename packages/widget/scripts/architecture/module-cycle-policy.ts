/**
 * Maps `src` files to Modules (`module-map.ts`) and reports Module cycles:
 * cycles between Modules even when their files are acyclic.
 *
 * Used by `check-architecture.ts`.
 */
import type { ICruiseResult } from "dependency-cruiser";

import { resolveModule } from "./module-map.ts";

type ModuleEdge = Readonly<{
  from: string;
  to: string;
  source: string;
  resolved: string;
}>;

export type ModuleCycle = Readonly<{
  edges: ReadonlyArray<ModuleEdge>;
  modules: ReadonlyArray<string>;
  path: ReadonlyArray<string>;
}>;

const buildModuleGraph = (modules: ICruiseResult["modules"]) => {
  const graph = new Map<string, Set<string>>();
  const edges: ModuleEdge[] = [];

  for (const module of modules) {
    const from = resolveModule(module.source);
    if (!from) continue;

    graph.set(from, graph.get(from) ?? new Set());
    for (const dependency of module.dependencies) {
      const to = resolveModule(dependency.resolved);
      if (!to || to === from) continue;

      graph.set(to, graph.get(to) ?? new Set());
      graph.get(from)?.add(to);
      edges.push({
        from,
        resolved: dependency.resolved,
        source: module.source,
        to,
      });
    }
  }

  return { edges, graph } as const;
};

const stronglyConnectedComponents = (
  graph: ReadonlyMap<string, Set<string>>
) => {
  const visited = new Set<string>();
  const order: string[] = [];
  const visit = (node: string) => {
    if (visited.has(node)) return;
    visited.add(node);
    for (const next of graph.get(node) ?? []) visit(next);
    order.push(node);
  };
  for (const node of graph.keys()) visit(node);

  const reverse = new Map<string, Set<string>>();
  for (const node of graph.keys()) reverse.set(node, new Set());
  for (const [from, targets] of graph) {
    for (const to of targets) reverse.get(to)?.add(from);
  }

  const assigned = new Set<string>();
  const components: string[][] = [];
  const collect = (node: string, component: string[]) => {
    if (assigned.has(node)) return;
    assigned.add(node);
    component.push(node);
    for (const next of reverse.get(node) ?? []) collect(next, component);
  };
  for (const node of order.toReversed()) {
    if (assigned.has(node)) continue;
    const component: string[] = [];
    collect(node, component);
    components.push(component.sort());
  }

  return components.filter((component) => component.length > 1);
};

const findCyclePath = (
  graph: ReadonlyMap<string, Set<string>>,
  component: ReadonlyArray<string>
) => {
  const members = new Set(component);
  const start = component[0];
  if (!start) return [];

  const search = (
    node: string,
    path: ReadonlyArray<string>,
    pathMembers: ReadonlySet<string>
  ): ReadonlyArray<string> | null => {
    for (const next of graph.get(node) ?? []) {
      if (!members.has(next)) continue;
      if (next === start) return [...path, start];
      if (pathMembers.has(next)) continue;

      const found = search(
        next,
        [...path, next],
        new Set([...pathMembers, next])
      );
      if (found) return found;
    }
    return null;
  };

  return search(start, [start], new Set([start])) ?? component;
};

export const findModuleCycles = (
  cruiseResult: Pick<ICruiseResult, "modules">
): ReadonlyArray<ModuleCycle> => {
  const { edges, graph } = buildModuleGraph(cruiseResult.modules);
  return stronglyConnectedComponents(graph).map((modules) => {
    const members = new Set(modules);
    return {
      edges: edges
        .filter((edge) => members.has(edge.from) && members.has(edge.to))
        .sort((left, right) =>
          `${left.from} ${left.to} ${left.source} ${left.resolved}`.localeCompare(
            `${right.from} ${right.to} ${right.source} ${right.resolved}`
          )
        ),
      modules,
      path: findCyclePath(graph, modules),
    };
  });
};

export const formatModuleCycles = (cycles: ReadonlyArray<ModuleCycle>) =>
  cycles
    .flatMap((cycle) => [
      `Module cycle: ${cycle.path.join(" -> ")}`,
      ...cycle.edges.map(
        (edge) =>
          `  ${edge.from} -> ${edge.to}: ${edge.source} -> ${edge.resolved}`
      ),
    ])
    .join("\n");
