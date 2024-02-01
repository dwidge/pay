// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

// https://www.npmjs.com/package/wait-for-expect

export function waitFor<T>(
  f: () => Promise<T>,
  timeout = 5000,
  interval = 250
) {
  if (interval < 1) interval = 1;
  var maxTries = Math.ceil(timeout / interval);
  var tries = 0;
  return new Promise<T>(function (resolve, reject) {
    var rejectOrRerun = function rejectOrRerun(error: unknown) {
      if (tries > maxTries) {
        reject(error);
        return;
      }

      setTimeout(runExpectation, interval);
    };

    function runExpectation() {
      tries += 1;

      try {
        Promise.resolve(f())
          .then(function (r) {
            return resolve(r);
          })
          .catch(rejectOrRerun);
      } catch (error) {
        rejectOrRerun(error);
      }
    }

    setTimeout(runExpectation, 0);
  });
}
