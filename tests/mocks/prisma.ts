import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { beforeEach } from "vitest";

export const prismaMock = mockDeep<PrismaClient>();

beforeEach(() => {
  mockReset(prismaMock);
  // Default $transaction implementation to execute the callback with the mock client
  // or resolve an array of promises for standard transactions.
  prismaMock.$transaction.mockImplementation((arg) => {
    if (typeof arg === "function") {
      return arg(prismaMock);
    }
    return Promise.all(arg);
  });
});
