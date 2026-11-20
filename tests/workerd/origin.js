// The stub origin every outbound fetch of the Worker under test reaches. It
// answers `POST` with the status named in the credential (a bearer token, or
// a Basic password: `Bearer status-302` → 302, with a `Location` a follower
// would chase) and counts the requests per credential; `GET /seen?key=…`
// reports the count (`key=pulled`: how many chunks of the huge 502 body were
// pulled).
const seen = {};

const isRedirect = (status) => status >= 300 && status < 400;

/** The status answered with an error body far larger than any send error keeps. */
const HUGE_BODY = 502;
const CHUNK = new TextEncoder().encode("e".repeat(64 * 1024));
const CHUNKS = 160;

/** 10 MiB of `e`, counting each chunk pulled under `pulled`, so a test can tell a bounded read from a buffered one. */
const hugeBody = () =>
  new ReadableStream(
    {
      pull(controller) {
        seen.pulled = (seen.pulled ?? 0) + 1;
        if (seen.pulled > CHUNKS) controller.close();
        else controller.enqueue(CHUNK);
      },
    },
    { highWaterMark: 0 },
  );

/** The answer for `status`. Following a redirect would count a second request under the same credential. */
const answer = (status) =>
  isRedirect(status)
    ? new Response("moved", { status, headers: { location: "https://api.resend.com/emails" } })
    : status === HUGE_BODY
      ? new Response(hugeBody(), { status })
      : Response.json({ id: "email_workerd", sid: "SM_workerd" }, { status });

/** The credential a request carries: a bearer token, or a Basic password. */
const credential = (authorization) =>
  authorization.startsWith("Basic ")
    ? atob(authorization.slice("Basic ".length)).split(":").slice(1).join(":")
    : authorization.replace(/^Bearer /, "");

/** Count one request for the credential, and answer the status it names. */
const record = (request) => {
  const key = credential(request.headers.get("authorization") ?? "");
  seen[key] = (seen[key] ?? 0) + 1;
  return answer(Number(key.replace(/^(?:[a-z]+-)?status-/, "")));
};

export default {
  fetch(request) {
    const url = new URL(request.url);
    return url.pathname === "/seen"
      ? new Response(String(seen[url.searchParams.get("key") ?? ""] ?? 0))
      : record(request);
  },
};
