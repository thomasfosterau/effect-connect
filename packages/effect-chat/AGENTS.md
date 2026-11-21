# @thomasfosterau/effect-connect-effect-chat

The core `ChatService` over Effect's `effect/chat` router: `send` is one `Chat.post` to a configured thread.

## Boundary

Imports the core and `effect/chat` only; never another provider, and never a platform adapter (`@effect/chat-slack`, `@effect/chat-discord`): the application registers those.

## Invariants

- **One configured thread**; a message never chooses its destination.
- **No HTTP of its own.** The registered adapter owns the request, its length check (`TooLarge` before any call) and its retries.
- **A `ChatError` maps to a `ChatSendError` without its cause**: the message is the `ChatError`'s redacted one, and the reason's unredacted cause is dropped.
- **`username` is dropped**: `effect/chat` posts as the bot.
- **`sendBatch` posts in order and stops at the first failure**; an empty batch posts nothing.
- **The `effect` peer floor is `^4.1.5`**, the release that added `effect/chat`; the core keeps `^4.0.0`.
