export const makeId = (n: number = 5) => Math.random().toFixed(n).slice(2);
export const makeTestId = (n: number = 5) => "test_" + makeId(n);
export const makeEmailAlias = (email: string, alias = makeId()) => {
  const [name, domain] = email.split("@");
  return name + "+" + alias + "@" + domain;
};
