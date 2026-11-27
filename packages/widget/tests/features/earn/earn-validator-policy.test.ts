import { Effect } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it, vi } from "vitest";

import {
  YieldValidatorsKey,
  YieldValidatorsPullKey,
} from "../../../src/features/earn/model/earn-selection/keys";
import { yieldValidatorsAtom } from "../../../src/features/earn/state/earn-selection/catalog/catalog";
import {
  YieldValidatorsKey as PositionValidatorsKey,
  yieldValidatorsPullAtom,
} from "../../../src/features/yield-entry/index";
import type { SKAppProps } from "../../../src/public-api/react-types";
import { appRuntime } from "../../../src/runtime/app-runtime";
import { updateWidgetConfigAtom } from "../../../src/runtime/widget-config";
import {
  ApiRequestError,
  type ValidatorDirectoryRequest,
} from "../../../src/services/api/resource-sources";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../../fixtures";
import { yieldResourceSourceLayer } from "../../utils/services/resource-sources";
import { decodeValidator } from "../../utils/validators";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

type ValidatorsConfig = NonNullable<SKAppProps["validatorsConfig"]>;

const { id: yieldId, token } = yieldApiYieldFixture();

const apiPreferred = [
  decodeValidator(
    yieldApiValidatorFixture({ address: "api-preferred", preferred: true })
  ),
];
const others = Array.from({ length: 150 }, (_, index) =>
  decodeValidator(yieldApiValidatorFixture({ address: `validator-${index}` }))
);
const directory = [...apiPreferred, ...others];

const unavailable = new ApiRequestError({
  cause: new Error("unavailable"),
  failure: {
    _tag: "ErrorStatus",
    body: { message: "unavailable" },
    status: 503,
  },
  operation: "validators",
});

/** The directory as the API serves it: names and addresses match by substring. */
const listed = ({ address, name, preferred }: ValidatorDirectoryRequest) => {
  if (address !== undefined) {
    return directory.filter((item) => item.address.includes(address));
  }
  if (name !== undefined) {
    return directory.filter((item) => item.name?.includes(name));
  }
  if (preferred === undefined) return directory;
  return preferred ? apiPreferred : others;
};
const listValidators = vi.fn((request: ValidatorDirectoryRequest) =>
  request.address === "unavailable"
    ? Effect.fail(unavailable)
    : Effect.succeed({
        items: listed(request).slice(
          request.offset,
          request.offset + request.limit
        ),
        limit: request.limit,
        offset: request.offset,
        total: listed(request).length,
      })
);

const makeRegistry = (validatorsConfig: ValidatorsConfig) => {
  listValidators.mockClear();
  return AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue({
        apiKey: "test-api-key",
        validatorsConfig,
        variant: "default",
      }),
      Atom.initialValue(
        appRuntime.layer,
        yieldResourceSourceLayer({ listValidators })
      ),
    ],
  });
};

const earnValidators = () =>
  yieldValidatorsAtom(
    new YieldValidatorsKey({ network: token.network, selectedYieldId: yieldId })
  );

const initialAddresses = (registry: AtomRegistry.AtomRegistry) =>
  AsyncResult.getOrThrow(
    registry.get(earnValidators().initialValidatorsResultAtom)
  ).items.map(({ address }) => address);

const readInitial = async (validatorsConfig: ValidatorsConfig) => {
  const registry = makeRegistry(validatorsConfig);
  const resource = earnValidators();
  const unmount = registry.mount(resource.initialValidatorsResultAtom);

  try {
    await vi.waitFor(() =>
      expect(
        AsyncResult.isSuccess(
          registry.get(resource.initialValidatorsResultAtom)
        )
      ).toBe(true)
    );
    const defaultPages = registry.get(
      resource.validatorsPullAtom(new YieldValidatorsPullKey({ search: null }))
    );
    return {
      defaultsDone: AsyncResult.getOrThrow(defaultPages).done,
      initial: AsyncResult.getOrThrow(
        registry.get(resource.initialValidatorsResultAtom)
      ),
    };
  } finally {
    unmount();
    registry.dispose();
  }
};

const rankedPolicy = (preferred: Array<string>) => ({
  [token.network]: { preferred, preferredOrder: "listed" as const },
});

describe("Earn validators under a Validator Policy", () => {
  it("keeps the API's preferred validators first without a listed order", async () => {
    const { initial } = await readInitial({
      [token.network]: { preferred: ["validator-120", "validator-3"] },
    });

    expect(
      initial.items
        .slice(0, 4)
        .map(({ address, preferred }) => ({ address, preferred }))
    ).toEqual([
      { address: "api-preferred", preferred: true },
      // On the first page, so in the directory's order; then the looked-up one.
      { address: "validator-3", preferred: true },
      { address: "validator-120", preferred: true },
      { address: "validator-0", preferred: false },
    ]);
  });

  it("lists the policy's preferred validators first, in its order, then the API's", async () => {
    const { initial } = await readInitial(
      rankedPolicy(["validator-120", "validator-3"])
    );

    expect(initial.complete).toBe(false);
    expect(
      initial.items
        .slice(0, 4)
        .map(({ address, preferred }) => ({ address, preferred }))
    ).toEqual([
      { address: "validator-120", preferred: true },
      { address: "validator-3", preferred: true },
      { address: "api-preferred", preferred: true },
      { address: "validator-0", preferred: false },
    ]);
    expect(listValidators).toHaveBeenCalledWith(
      expect.objectContaining({ address: "validator-120", status: "active" })
    );
  });

  it("follows the policy when the host reorders its preferred validators", async () => {
    const registry = makeRegistry(
      rankedPolicy(["validator-120", "validator-3"])
    );
    const unmount = registry.mount(
      earnValidators().initialValidatorsResultAtom
    );

    try {
      await vi.waitFor(() =>
        expect(initialAddresses(registry).slice(0, 2)).toEqual([
          "validator-120",
          "validator-3",
        ])
      );

      registry.set(updateWidgetConfigAtom, {
        apiKey: "test-api-key",
        validatorsConfig: {
          [token.network]: {
            preferred: ["validator-3", "validator-120"],
            preferredOrder: "listed",
          },
        },
        variant: "default",
      });

      await vi.waitFor(() =>
        expect(initialAddresses(registry).slice(0, 2)).toEqual([
          "validator-3",
          "validator-120",
        ])
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("ranks search results by the policy's preferred order", async () => {
    const registry = makeRegistry(
      rankedPolicy(["validator-140", "validator-12"])
    );
    const search = earnValidators().validatorsPullAtom(
      new YieldValidatorsPullKey({ search: "validator-1" })
    );
    const unmount = registry.mount(search);

    try {
      await vi.waitFor(() =>
        expect(AsyncResult.isSuccess(registry.get(search))).toBe(true)
      );
      const found = AsyncResult.getOrThrow(registry.get(search)).items.flatMap(
        (page) => page.items.map(({ address }) => address)
      );
      expect(found.slice(0, 3)).toEqual([
        "validator-140",
        "validator-12",
        "validator-1",
      ]);
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("ranks search results across every loaded page", async () => {
    const registry = makeRegistry(
      rankedPolicy(["validator-140", "validator-12"])
    );
    // 150 matches: validator-12 on the first page, validator-140 on the second.
    const search = earnValidators().validatorsPullAtom(
      new YieldValidatorsPullKey({ search: "validator" })
    );
    const unmount = registry.mount(search);
    const found = () =>
      AsyncResult.getOrThrow(registry.get(search)).items.flatMap((page) =>
        page.items.map(({ address }) => address)
      );

    try {
      await vi.waitFor(() =>
        expect(AsyncResult.isSuccess(registry.get(search))).toBe(true)
      );
      registry.set(search, undefined);

      await vi.waitFor(() => expect(found()).toContain("validator-140"));
      expect(found().slice(0, 3)).toEqual([
        "validator-140",
        "validator-12",
        "validator-0",
      ]);
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("lists exactly the allowed validators without paging the directory", async () => {
    const { defaultsDone, initial } = await readInitial({
      [token.network]: { allowed: ["validator-120", "validator-7"] },
    });

    expect(initial.complete).toBe(true);
    expect(initial.items.map(({ address }) => address)).toEqual([
      "validator-120",
      "validator-7",
    ]);
    expect(defaultsDone).toBe(true);
    expect(
      listValidators.mock.calls.every(([request]) => request.address)
    ).toBe(true);
  });

  it("keeps an allowlist incomplete when a lookup fails", async () => {
    const { initial } = await readInitial({
      [token.network]: { allowed: ["validator-7", "unavailable"] },
    });

    expect(initial.complete).toBe(false);
    expect(initial.items.map(({ address }) => address)).toEqual([
      "validator-7",
    ]);
  });
});

describe("Position validators under a Validator Policy", () => {
  it("lists the policy's preferred validators first on the first page and skips them on later ones", async () => {
    const registry = makeRegistry(
      rankedPolicy(["validator-120", "validator-3"])
    );
    const pull = yieldValidatorsPullAtom(
      new PositionValidatorsKey({
        network: token.network,
        search: null,
        yieldId,
      })
    );
    const unmount = registry.mount(pull);
    const pages = () =>
      AsyncResult.getOrThrow(registry.get(pull)).items.map((page) =>
        page.items.map(({ address }) => address)
      );

    try {
      await vi.waitFor(() =>
        expect(AsyncResult.isSuccess(registry.get(pull))).toBe(true)
      );
      expect(pages()[0]?.slice(0, 4)).toEqual([
        "validator-120",
        "validator-3",
        "api-preferred",
        "validator-0",
      ]);

      registry.set(pull, undefined);

      await vi.waitFor(() => expect(pages()).toHaveLength(2));
      expect(pages()[1]).toContain("validator-119");
      expect(pages()[1]).not.toContain("validator-120");
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
