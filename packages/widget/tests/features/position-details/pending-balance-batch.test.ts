import { DateTime, Schema } from "effect";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { EarnBalance } from "../../../src/domain/earn/models";
import { groupPositionBalanceRows } from "../../../src/domain/portfolio/positions";
import { getPendingBalanceBatchDetails } from "../../../src/features/position-details/model/pending-balance-batch";
import { yieldBalanceFixture } from "../../fixtures";

const t = ((key: string, options?: Record<string, unknown>) =>
  `${key}:${JSON.stringify(options ?? {})}`) as TFunction;

const batch = (id: string) => ({
  address: "0x084fd3a5000000000000000000000000000eEc1",
  explorerUrl: "https://etherscan.io/address/0x084f",
  id,
  requests: [
    {
      explorerUrl: "https://etherscan.io/tx/0xa",
      submittedAt: "2026-10-19T17:04:00.000Z",
      transactionHash: "0xa",
    },
    {
      explorerUrl: "https://etherscan.io/tx/0xb",
      submittedAt: "2026-10-19T17:21:00.000Z",
      transactionHash: "0xb",
    },
  ],
});

const decode = (overrides: Record<string, unknown>) => {
  const input: unknown = {
    ...yieldBalanceFixture({
      date: "2026-10-20T18:00:00.000Z",
      isEncrypted: true,
      type: "entering",
    }),
    ...overrides,
  };
  return Schema.decodeUnknownSync(EarnBalance)(input);
};

describe("pending balance batch", () => {
  it("keeps the balance when its batch is malformed", () => {
    expect(decode({ batch: { id: 37 } }).batch).toBeNull();
    expect(decode({}).batch).toBeUndefined();
    expect(decode({ batch: batch("37") }).batch?.requests).toHaveLength(2);
  });

  it("keeps batches due at the same time as separate rows", () => {
    const rows = groupPositionBalanceRows([
      decode({ batch: batch("37") }),
      decode({ batch: batch("38") }),
    ]);

    expect(rows.map((row) => row.batch?.id)).toEqual(["37", "38"]);
  });

  it("keeps same-numbered batches from different batchers apart", () => {
    const rows = groupPositionBalanceRows([
      decode({ batch: batch("37") }),
      decode({
        batch: {
          ...batch("37"),
          address: "0x0000000000000000000000000000000000000001",
        },
      }),
    ]);

    expect(rows.map((row) => row.batch?.address)).toEqual([
      batch("37").address,
      "0x0000000000000000000000000000000000000001",
    ]);
  });

  it("lists every request with its explorer link and the batcher", () => {
    const [row] = groupPositionBalanceRows([decode({ batch: batch("37") })]);
    const details = getPendingBalanceBatchDetails({
      balance: row!,
      locale: "en",
      t,
      timeZone: DateTime.zoneMakeNamedUnsafe("UTC"),
    });

    expect(details).toEqual({
      batcher: {
        key: batch("37").address,
        label: "0x084f…eEc1",
        url: "https://etherscan.io/address/0x084f",
      },
      requests: [
        {
          key: "0xa",
          label: "Oct 19, 17:04",
          url: "https://etherscan.io/tx/0xa",
        },
        {
          key: "0xb",
          label: "Oct 19, 17:21",
          url: "https://etherscan.io/tx/0xb",
        },
      ],
      requestsLabel: 'position_details.batch.deposits:{"count":2}',
      title: 'position_details.batch.title:{"id":"37"}',
    });
  });
});
