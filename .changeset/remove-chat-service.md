---
"@thomasfosterau/effect-connect": minor
---

Remove the chat channel in favour of Effect's own `effect/chat` (effect 4.1.5+). `ChatMessage`, `ChatSendResult`, `ChatService`, `sendChat`, `sendChatBatch`, `decodeChatMessage`, `ChatSendError`, `ChatValidationError` and the `./Chat` and `./ChatService` subpaths are gone. Post through `Chat.Chat` instead: `sendChat({ text })` becomes `chat.post(thread, { markdown: text })`, with `@effect/chat-slack` or `@effect/chat-discord` as the adapter and `ChatTest.layer()` in tests. See the Chat section of docs/core.md.
