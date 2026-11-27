# @thomasfosterau/effect-connect-react-email

## 0.6.0

### Minor Changes

- [#225](https://github.com/thomasfosterau/effect-connect/pull/225) [`929d1dd`](https://github.com/thomasfosterau/effect-connect/commit/929d1dd5cc6ba7619bf9f7e550107e4799b654df) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - The package root now exports one namespace, `ReactEmail`, instead of its members flat. The `./ReactEmail` subpath is unchanged.
  
  Migration: `import * as ReactEmail from "@thomasfosterau/effect-connect-react-email"` becomes `import { ReactEmail } from "@thomasfosterau/effect-connect-react-email"`; `ReactEmail.template` and `ReactEmail.accessibleDefaults` read as before. A named root import such as `import { template } from "@thomasfosterau/effect-connect-react-email"` becomes `ReactEmail.template`, or the same named import from `@thomasfosterau/effect-connect-react-email/ReactEmail`.

### Patch Changes

- Updated dependencies [[`ec80a94`](https://github.com/thomasfosterau/effect-connect/commit/ec80a94f90d9580f2d7abda8999bf3643a73d7ce), [`929d1dd`](https://github.com/thomasfosterau/effect-connect/commit/929d1dd5cc6ba7619bf9f7e550107e4799b654df), [`23ecaa8`](https://github.com/thomasfosterau/effect-connect/commit/23ecaa86e1e18aa47d1057faec5e6ad198a7c489), [`8ad498f`](https://github.com/thomasfosterau/effect-connect/commit/8ad498f982daaf7ef367ea617e047902c98f3e2c)]:
  - @thomasfosterau/effect-connect@0.6.0

## 0.5.0

### Minor Changes

- [#197](https://github.com/thomasfosterau/effect-connect/pull/197) [`218cb24`](https://github.com/thomasfosterau/effect-connect/commit/218cb24007c8fde682bff043234bfd71ddbb84b3) Thanks [@thomasfosterau](https://github.com/thomasfosterau)! - New package: React Email as an `EmailTemplate` renderer. `template` builds a core `EmailTemplate` from a React Email component, with typed data, per-locale messages, `lang` / `dir` / `<title>` filled in from the negotiated locale and subject, and a plain-text part that is derived, rendered by React Email or written alongside.

### Patch Changes

- Updated dependencies [[`8ad9ffb`](https://github.com/thomasfosterau/effect-connect/commit/8ad9ffbc48c0a607a40de1b952e10bf74bb361a3), [`a5da9a1`](https://github.com/thomasfosterau/effect-connect/commit/a5da9a166a858b5a15c076b670a596abc5953a3e)]:
  - @thomasfosterau/effect-connect@0.5.0
