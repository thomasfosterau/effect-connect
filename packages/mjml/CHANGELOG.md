# @thomasfosterau/effect-connect-mjml

## 0.5.0

### Minor Changes

- [#198](https://github.com/thomasfosterau/effect-connect/pull/198) [`56f3fc9`](https://github.com/thomasfosterau/effect-connect/commit/56f3fc94fff6958fc95b8a55328ee97ab8578468) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - New package: MJML as an `EmailTemplate` renderer. `template` builds a core `EmailTemplate` from MJML written with the core's escaping `html` tag, with typed data, per-locale messages, `lang` / `dir` / `<mj-title>` filled in from the negotiated locale and subject, strict validation by default, and a plain-text part that is derived or written alongside. It compiles with `mjml-browser`, so it runs on Workers.

### Patch Changes

- Updated dependencies [[`8ad9ffb`](https://github.com/thomasfosterau/effect-connect/commit/8ad9ffbc48c0a607a40de1b952e10bf74bb361a3), [`a5da9a1`](https://github.com/thomasfosterau/effect-connect/commit/a5da9a166a858b5a15c076b670a596abc5953a3e)]:
  - @thomasfosterau/effect-connect@0.5.0
