import * as Atom from "effect/unstable/reactivity/Atom";

export const makeTransactionWorkflowLifecycleAtom = <Input>(
  inputAtom: Atom.Writable<Input | null, Input | null>,
  label: string
) =>
  Atom.make((context) => {
    const registry = context.registry;
    const mountedInput = context.once(inputAtom);

    context.addFinalizer(() => {
      if (registry.get(inputAtom) === mountedInput) {
        registry.set(inputAtom, null);
      }
    });
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel(label));
