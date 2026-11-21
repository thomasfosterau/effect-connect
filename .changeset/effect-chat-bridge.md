---
"@thomasfosterau/effect-connect-effect-chat": minor
---

New package: the core `ChatService` over Effect's `effect/chat` router (effect 4.1.5). `EffectChat.layer({ thread })` posts each message to one configured thread through whichever `effect/chat` adapter is registered for its platform, such as `@effect/chat-slack` or `@effect/chat-discord`.
