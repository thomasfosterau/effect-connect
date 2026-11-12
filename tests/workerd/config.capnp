# `workerd test` runs every `test` handler the `main` Worker exports. Its
# outbound fetches all go to the `origin` Worker (`globalOutbound`), so the
# run needs no network and no port.
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "main", worker = .main),
    (name = "origin", worker = .origin),
  ],
);

const main :Workerd.Worker = (
  modules = [(name = "worker.js", esModule = embed ".build/worker.js")],
  compatibilityDate = "2026-02-19",
  compatibilityFlags = ["nodejs_compat"],
  bindings = [(name = "ORIGIN", service = "origin")],
  globalOutbound = "origin",
);

const origin :Workerd.Worker = (
  modules = [(name = "origin.js", esModule = embed "origin.js")],
  compatibilityDate = "2026-02-19",
);
