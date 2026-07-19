import { describe, expectTypeOf, it } from "vitest";
import type * as bundleEntry from "../../src/index.bundle";
import type * as packageEntry from "../../src/index.package";
import type {
  BundledSKWidgetProps,
  SKWallet as BundleWallet,
  BundledSKWidgetProps as DeclaredBundledSKWidgetProps,
  SKWallet as DeclaredBundleWallet,
  SKWallet as DeclaredPackageWallet,
  SKAppProps as DeclaredSKAppProps,
  SKWallet as PackageWallet,
  SKAppProps,
} from "../../src/public-api/types";

type PublicBundle = typeof import("../../src/public-api/index.bundle");
type PublicPackage = typeof import("../../src/public-api/index.package");

describe("public declaration contracts", () => {
  it("keeps the package runtime exports compatible with the public facade", () => {
    expectTypeOf<keyof typeof packageEntry>().toEqualTypeOf<
      keyof PublicPackage
    >();
    expectTypeOf<typeof packageEntry>().toExtend<PublicPackage>();
  });

  it("keeps the bundled runtime exports compatible with the public facade", () => {
    expectTypeOf<keyof typeof bundleEntry>().toEqualTypeOf<
      keyof PublicBundle
    >();
    expectTypeOf<typeof bundleEntry>().toExtend<PublicBundle>();
  });

  it("keeps the exported consumer types identical to the public contracts", () => {
    expectTypeOf<SKAppProps>().toEqualTypeOf<DeclaredSKAppProps>();
    expectTypeOf<BundledSKWidgetProps>().toEqualTypeOf<DeclaredBundledSKWidgetProps>();
    expectTypeOf<PackageWallet>().toEqualTypeOf<DeclaredPackageWallet>();
    expectTypeOf<BundleWallet>().toEqualTypeOf<DeclaredBundleWallet>();
  });
});
