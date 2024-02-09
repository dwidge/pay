// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor<T>(
  f: () => Promise<T>,
  retries = 5,
  interval = 1000
) {
  while (true) {
    try {
      return await f();
    } catch (error) {
      if (retries-- <= 0) throw error;
      await delay(interval);
    }
  }
}

export const waitForF =
  <F extends (...args: any[]) => any>(f: F) =>
  (...args: Parameters<F>) =>
    waitFor<ReturnType<F>>(() => f(...args));
