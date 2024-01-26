import { it } from "node:test";
import { expect } from "expect";
import "./toBeWithinRange.js";

it("toBeWithinRange", async () => {
  expect(1).toBeWithinRange(1, 6);
  expect(0).not.toBeWithinRange(1, 6);
  expect({ b: 4 }).toMatchObject({ b: expect.toBeWithinRange(1, 4) });
  expect({ b: 8 }).not.toMatchObject({ b: expect.toBeWithinRange(1, 4) });
});
