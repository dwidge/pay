import { expect, type MatcherContext, type MatcherFunction } from "expect";

// https://kettanaito.com/blog/practical-guide-to-custom-jest-matchers
// https://stackoverflow.com/questions/39853825/how-to-extend-an-interface-declared-in-an-external-library-d-ts

expect.extend({
  toBeWithinRange(
    this: MatcherContext,
    actual: number,
    min: number,
    max: number
  ) {
    if (typeof actual !== "number") {
      throw new Error("Actual value must be a number");
    }
    const pass = actual >= min && actual <= max;
    return {
      pass,
      message: pass
        ? () =>
            `expected ${actual} not to be within range (${min}..${max}), it's (${
              actual - min
            }..${actual - max})`
        : () =>
            `expected ${actual} to be within range (${min}..${max}), it's (${
              actual - min
            }..${actual - max})`,
    };
  },
});

declare module "expect" {
  export interface AsymmetricMatchers {
    toBeWithinRange(min: number, max: number): AsymmetricMatcher<number>;
  }

  export interface Matchers<R extends void | Promise<void>, T = unknown> {
    toBeWithinRange(min: number, max: number): R;
  }
}
