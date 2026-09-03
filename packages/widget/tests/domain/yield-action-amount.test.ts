import { describe, expect, it } from "vitest";
import { isYieldActionAmountEditable } from "../../src/domain/earn/stake";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../fixtures";

const yieldWithExitAmount = ({
  maximum,
  minimum,
  required,
}: {
  readonly maximum?: string;
  readonly minimum?: string;
  readonly required: boolean;
}) => {
  const base = yieldApiYieldDtoFixture();

  return yieldApiYieldFixture({
    mechanics: {
      ...base.mechanics,
      arguments: {
        ...base.mechanics.arguments,
        exit: {
          fields: [
            {
              label: "Amount",
              name: "amount",
              required,
              type: "string",
              ...(maximum === undefined ? {} : { maximum }),
              ...(minimum === undefined ? {} : { minimum }),
            },
          ],
        },
      },
    },
  });
};

describe("isYieldActionAmountEditable", () => {
  it("locks Exit when the yield does not advertise an amount argument", () => {
    expect(isYieldActionAmountEditable(yieldApiYieldFixture(), "exit")).toBe(
      false
    );
  });

  it("allows a partial Exit when amount is advertised but not required", () => {
    expect(
      isYieldActionAmountEditable(
        yieldWithExitAmount({ required: false }),
        "exit"
      )
    ).toBe(true);
  });

  it("allows a partial Exit when amount is required", () => {
    expect(
      isYieldActionAmountEditable(
        yieldWithExitAmount({ required: true }),
        "exit"
      )
    ).toBe(true);
  });

  it("locks Exit when amount is force-max", () => {
    expect(
      isYieldActionAmountEditable(
        yieldWithExitAmount({
          maximum: "-1",
          minimum: "-1",
          required: true,
        }),
        "exit"
      )
    ).toBe(false);
  });
});
