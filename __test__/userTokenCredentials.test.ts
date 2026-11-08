/**
 * Copyright © 2026 ReactVision
 *
 * createUserTokenCredentials(): the backend is asked for a user token only
 * when there is none, when the one held is close to expiring, or when it was
 * refused; requests at the same moment share one fetch; and a token fetched
 * for the user who signed out is never kept.
 */
jest.mock("../components/Studio/VRTStudioModule", () => ({ VRTStudioModule: {} }));

import { createUserTokenCredentials } from "../components/AR/ViroUserTokenCredentials";

const S = 1000;
let now = 0;
beforeEach(() => {
  now = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => jest.restoreAllMocks());

function jwt(claims: Record<string, unknown>) {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `rv_ut_${part({ alg: "HS256", typ: "rv+aut" })}.${part(claims)}.sig`;
}

/** fetchToken answering from `answers` in turn. */
function backend(...answers: unknown[]) {
  return jest.fn(async () => {
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return next as any;
  });
}

const settle = () => new Promise((r) => setTimeout(r, 0));

async function tokenOf(credentials: (r?: any) => Promise<any>, request?: any) {
  return (await credentials(request)).accessToken;
}

it("asks the backend once, and keeps the token until two minutes before it expires", async () => {
  const fetchToken = backend({ token: "a", expires_in: 3600 }, { token: "b", expires_in: 3600 });
  const credentials = createUserTokenCredentials({ projectId: "p", fetchToken });

  await expect(credentials()).resolves.toEqual({ projectId: "p", accessToken: "a" });
  now += 3480 * S - 1;
  expect(await tokenOf(credentials)).toBe("a");
  now += 1;
  expect(await tokenOf(credentials)).toBe("b");
  expect(fetchToken).toHaveBeenCalledTimes(2);
});

it("replaces a short token with a quarter of its life left", async () => {
  const fetchToken = backend({ token: "a", expires_in: 60 }, { token: "b", expires_in: 60 });
  const credentials = createUserTokenCredentials({ projectId: "p", fetchToken });
  await credentials();
  now += 44 * S;
  expect(await tokenOf(credentials)).toBe("a");
  now += 1 * S;
  expect(await tokenOf(credentials)).toBe("b");
});

it("takes the lifetime from the token's own claims when given the token alone, whatever the phone's clock says", async () => {
  // iat and exp are years from the mocked clock: only their difference counts
  const fetchToken = backend(jwt({ iat: 5_000_000_000, exp: 5_000_000_600 }), "next");
  const credentials = createUserTokenCredentials({ projectId: "p", fetchToken });
  await credentials();
  now += 479 * S;
  expect(await tokenOf(credentials)).toMatch(/^rv_ut_/);
  now += 1 * S;
  expect(await tokenOf(credentials)).toBe("next");
});

it("keeps a token with no lifetime until it is refused", async () => {
  const fetchToken = backend("a", "b");
  const credentials = createUserTokenCredentials({ projectId: "p", fetchToken });
  await credentials();
  now += 10 * 3600 * S;
  expect(await tokenOf(credentials)).toBe("a");
  expect(await tokenOf(credentials, { refusedToken: "a" })).toBe("b");
});

it("shares one fetch between requests made at the same time", async () => {
  let release: (v: unknown) => void = () => {};
  const fetchToken = jest.fn(() => new Promise<any>((r) => (release = r)));
  const credentials = createUserTokenCredentials({ projectId: "p", fetchToken });
  const all = Promise.all([credentials(), credentials(), credentials()]);
  await settle();
  release({ token: "a", expires_in: 3600 });
  expect((await all).map((c) => c.accessToken)).toEqual(["a", "a", "a"]);
  expect(fetchToken).toHaveBeenCalledTimes(1);
});

it("fetches again for a refused token, but not when the token held has already replaced it", async () => {
  const fetchToken = backend({ token: "a", expires_in: 3600 }, { token: "b", expires_in: 3600 });
  const credentials = createUserTokenCredentials({ projectId: "p", fetchToken });
  await credentials();
  expect(await tokenOf(credentials, { refusedToken: "a" })).toBe("b");
  expect(await tokenOf(credentials, { refusedToken: "a" })).toBe("b");
  expect(fetchToken).toHaveBeenCalledTimes(2);
});

it("keeps using the token while a refresh fails, until it expires", async () => {
  const down = new Error("backend down");
  const fetchToken = backend({ token: "a", expires_in: 600 }, down, down);
  const credentials = createUserTokenCredentials({ projectId: "p", fetchToken });
  await credentials();
  now += 500 * S;
  expect(await tokenOf(credentials)).toBe("a");
  now += 100 * S;
  await expect(credentials()).rejects.toBe(down);
});

it("never uses a refused token again, even while the backend is down", async () => {
  const down = new Error("backend down");
  const fetchToken = backend({ token: "a", expires_in: 3600 }, down);
  const credentials = createUserTokenCredentials({ projectId: "p", fetchToken });
  await credentials();
  await expect(credentials({ refusedToken: "a" })).rejects.toBe(down);
});

it("forgets the token on clear(), and does not keep one fetched for the user who signed out", async () => {
  let release: (v: unknown) => void = () => {};
  const fetchToken = jest
    .fn()
    .mockImplementationOnce(() => new Promise((r) => (release = r)))
    .mockResolvedValue({ token: "new", expires_in: 3600 });
  const credentials = createUserTokenCredentials({ projectId: "p", fetchToken });

  const before = credentials();
  await settle();
  credentials.clear();
  release({ token: "old", expires_in: 3600 });
  expect((await before).accessToken).toBe("old");

  expect(await tokenOf(credentials)).toBe("new");
  expect(await tokenOf(credentials)).toBe("new");
  expect(fetchToken).toHaveBeenCalledTimes(2);
});

it("refuses an answer with no token, and asks again next time", async () => {
  const fetchToken = backend({ expires_in: 3600 }, { token: "a", expires_in: 3600 });
  const credentials = createUserTokenCredentials({ projectId: "p", fetchToken });
  await expect(credentials()).rejects.toThrow("fetchToken gave no token");
  expect(await tokenOf(credentials)).toBe("a");
});
