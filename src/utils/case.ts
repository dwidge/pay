// Copyright DWJ 2023.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import { snakeCase } from "change-case";

export const objSnakeCase = (
  obj: Record<string, string | undefined>
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(obj)
      .map(([k, v]) => [snakeCase(k), v])
      .filter(([k]) => k)
  );
