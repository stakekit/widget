import { act, type ComponentType, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach } from "vitest";

type Wrapper = ComponentType<{ children: ReactNode }>;

const mountedRoots = new Set<{ container: HTMLElement; root: Root }>();

const cleanupRoot = (entry: { container: HTMLElement; root: Root }) => {
  act(() => entry.root.unmount());
  entry.container.remove();
  mountedRoots.delete(entry);
};

export const render = async (ui: ReactNode) => {
  const container = document.createElement("div");
  document.body.append(container);

  const root = createRoot(container);
  const entry = { container, root };
  mountedRoots.add(entry);

  await act(async () => root.render(ui));

  return {
    container,
    rerender: async (nextUi: ReactNode) => {
      await act(async () => root.render(nextUi));
    },
    unmount: () => cleanupRoot(entry),
  };
};

export const renderHook = async <Result, Props = undefined>(
  callback: (props: Props) => Result,
  options: {
    initialProps?: Props;
    wrapper?: Wrapper;
  } = {}
) => {
  let current: Result;
  let props = options.initialProps as Props;

  const TestComponent = () => {
    current = callback(props);
    return null;
  };
  const getUi = () => {
    const hook = createElement(TestComponent);
    return options.wrapper ? createElement(options.wrapper, null, hook) : hook;
  };
  const app = await render(getUi());

  return {
    act,
    result: {
      get current() {
        return current;
      },
    },
    rerender: async (nextProps: Props) => {
      props = nextProps;
      await app.rerender(getUi());
    },
    unmount: app.unmount,
  };
};

afterEach(() => {
  for (const entry of [...mountedRoots]) {
    cleanupRoot(entry);
  }
});
