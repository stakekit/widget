import type { ICruiseResult } from "dependency-cruiser";
import type {
  ModuleCollectionDeclaration,
  OwnedModuleDeclaration,
} from "./dependency-cruiser.config.mts";

export type ModuleCyclePolicy = Readonly<{
  moduleCollections: ReadonlyArray<ModuleCollectionDeclaration>;
  ownedModules: ReadonlyArray<OwnedModuleDeclaration>;
}>;

export type OwnedModuleEdge = Readonly<{
  from: string;
  to: string;
}>;

type ConcreteModuleEdge = OwnedModuleEdge &
  Readonly<{
    source: string;
    resolved: string;
  }>;

export type OwnedModuleCycle = Readonly<{
  edges: ReadonlyArray<ConcreteModuleEdge>;
  modules: ReadonlyArray<string>;
  path: ReadonlyArray<string>;
}>;

export type ModuleCycleCheck = Readonly<{
  cycles: ReadonlyArray<OwnedModuleCycle>;
  staleBaseline: ReadonlyArray<OwnedModuleEdge>;
  unbaselinedEdges: ReadonlyArray<OwnedModuleEdge>;
}>;

const edgeKey = ({ from, to }: OwnedModuleEdge) => `${from} -> ${to}`;

const matchesCollection = (
  source: string,
  declaration: ModuleCollectionDeclaration
) => {
  const prefix = `${declaration.root}/`;
  if (!source.startsWith(prefix)) return null;

  const child = source.slice(prefix.length).split("/")[0];
  if (!child || declaration.excludedChildren?.includes(child)) return null;

  return `${declaration.root}/${child}`;
};

export const resolveOwnedModule = (
  source: string,
  policy: ModuleCyclePolicy
) => {
  const collectionOwners = policy.moduleCollections.flatMap((declaration) => {
    const owner = matchesCollection(source, declaration);
    return owner ? [owner] : [];
  });
  const singularOwners = policy.ownedModules.flatMap((declaration) =>
    source === declaration.root || source.startsWith(`${declaration.root}/`)
      ? [declaration.root]
      : []
  );

  return (
    [...collectionOwners, ...singularOwners].sort(
      (left, right) => right.length - left.length
    )[0] ?? null
  );
};

const buildOwnedGraph = (
  modules: ICruiseResult["modules"],
  policy: ModuleCyclePolicy
) => {
  const graph = new Map<string, Set<string>>();
  const concreteEdges = new Map<string, ConcreteModuleEdge[]>();

  for (const module of modules) {
    const from = resolveOwnedModule(module.source, policy);
    if (!from) continue;

    graph.set(from, graph.get(from) ?? new Set());
    for (const dependency of module.dependencies) {
      const to = resolveOwnedModule(dependency.resolved, policy);
      if (!to || to === from) continue;

      graph.set(to, graph.get(to) ?? new Set());
      graph.get(from)?.add(to);
      const edge = {
        from,
        resolved: dependency.resolved,
        source: module.source,
        to,
      };
      const key = edgeKey(edge);
      concreteEdges.set(key, [...(concreteEdges.get(key) ?? []), edge]);
    }
  }

  return { concreteEdges, graph } as const;
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

const uniqueOwnedEdges = (edges: ReadonlyArray<ConcreteModuleEdge>) =>
  Array.from(
    new Map(
      edges.map((edge) => [edgeKey(edge), { from: edge.from, to: edge.to }])
    ).values()
  ).sort((left, right) => edgeKey(left).localeCompare(edgeKey(right)));

export const checkOwnedModuleCycles = ({
  baseline,
  cruiseResult,
  policy,
}: Readonly<{
  baseline: ReadonlyArray<OwnedModuleEdge>;
  cruiseResult: Pick<ICruiseResult, "modules">;
  policy: ModuleCyclePolicy;
}>): ModuleCycleCheck => {
  const { concreteEdges, graph } = buildOwnedGraph(
    cruiseResult.modules,
    policy
  );
  const cycles = stronglyConnectedComponents(graph).map((modules) => {
    const members = new Set(modules);
    const edges = Array.from(concreteEdges.values())
      .flat()
      .filter((edge) => members.has(edge.from) && members.has(edge.to))
      .sort((left, right) =>
        `${edgeKey(left)} ${left.source} ${left.resolved}`.localeCompare(
          `${edgeKey(right)} ${right.source} ${right.resolved}`
        )
      );
    return { edges, modules, path: findCyclePath(graph, modules) };
  });
  const activeEdges = uniqueOwnedEdges(cycles.flatMap((cycle) => cycle.edges));
  const activeKeys = new Set(activeEdges.map(edgeKey));
  const baselineKeys = new Set(baseline.map(edgeKey));

  return {
    cycles,
    staleBaseline: baseline.filter((edge) => !activeKeys.has(edgeKey(edge))),
    unbaselinedEdges: activeEdges.filter(
      (edge) => !baselineKeys.has(edgeKey(edge))
    ),
  };
};

export const formatModuleCycleCheck = (check: ModuleCycleCheck) => {
  const lines: string[] = [];
  for (const cycle of check.cycles) {
    lines.push(`Owned Module cycle: ${cycle.path.join(" -> ")}`);
    for (const edge of cycle.edges) {
      lines.push(
        `  ${edge.from} -> ${edge.to}: ${edge.source} -> ${edge.resolved}`
      );
    }
  }
  if (check.unbaselinedEdges.length > 0) {
    lines.push("Unbaselined cyclic Module edges:");
    for (const edge of check.unbaselinedEdges) lines.push(`  ${edgeKey(edge)}`);
  }
  if (check.staleBaseline.length > 0) {
    lines.push("Stale Module-cycle baseline edges (remove them):");
    for (const edge of check.staleBaseline) lines.push(`  ${edgeKey(edge)}`);
  }
  return lines.join("\n");
};
