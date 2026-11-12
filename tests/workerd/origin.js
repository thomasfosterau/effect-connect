// The stub origin every outbound fetch of the Worker under test reaches. It
// answers `POST` with the status named in the bearer credential
// (`Bearer status-302` → 302, with a `Location` a follower would chase) and
// counts the requests per credential; `GET /seen?key=…` reports the count.
const seen = {};

const isRedirect = (status) => status >= 300 && status < 400;

/** The answer for `status`. Following a redirect would count a second request under the same credential. */
const answer = (status) =>
  isRedirect(status)
    ? new Response("moved", { status, headers: { location: "https://api.resend.com/emails" } })
    : Response.json({ id: "email_workerd" }, { status });

/** Count one request for the credential, and answer the status it names. */
const record = (request) => {
  const key = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  seen[key] = (seen[key] ?? 0) + 1;
  return answer(Number(key.replace(/^status-/, "")));
};

export default {
  fetch(request) {
    const url = new URL(request.url);
    return url.pathname === "/seen"
      ? new Response(String(seen[url.searchParams.get("key") ?? ""] ?? 0))
      : record(request);
  },
};
