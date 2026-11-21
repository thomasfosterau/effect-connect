# `@thomasfosterau/effect-connect-effect-chat`

Detail for the [package README](../packages/effect-chat/README.md): the [core](./core.md)'s `ChatService` over Effect's own `effect/chat` router (added in `effect` 4.1.5). Every message is one `Chat.post` to a thread you configure, and whichever `effect/chat` adapter is registered for that thread's platform delivers it: `@effect/chat-slack`, `@effect/chat-discord`, or `ChatTest` in a test.

## When to use it

`effect/chat` is a whole chat-bot framework: inbound events, threads, history, buttons, modals, slash commands and streaming replies, across platforms. The core's `ChatService` is the narrow end of that, "post this notification". Use this package when application code should keep calling `sendChat` while the edge decides which platform, and through which adapter, it lands on. Code that needs more than posting uses `effect/chat` directly; both can share one `Chat.layer`.

## Usage

```ts
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Chat from "effect/chat/Chat";
import * as ChatThread from "effect/chat/ChatThread";
import { FetchHttpClient } from "effect/http";
import * as SlackChat from "@effect/chat-slack/SlackChat";
import { sendChat } from "@thomasfosterau/effect-connect";
import * as EffectChat from "@thomasfosterau/effect-connect-effect-chat";

const SlackLive = SlackChat.layer({
  botToken: Redacted.make(process.env.SLACK_BOT_TOKEN!),
  teamId: "T1",
}).pipe(Layer.provideMerge(Chat.layer), Layer.provide(FetchHttpClient.layer));

export const ChatLive = EffectChat.layer({ thread: ChatThread.make("slack", "T1/C1") }).pipe(
  Layer.provide(SlackLive),
);

export const announce = (version: string) => sendChat({ text: `Deployed **${version}**` });
```

The thread is an `effect/chat` address; its `id` belongs to the adapter (Slack's is `{team}/{channel}`, Discord's is the channel snowflake). A configured `{platform}:{id}` string decodes with `ChatThread.FromString`.

## Message mapping

| `ChatMessage` | `effect/chat` |
| --- | --- |
| `text` | `post`'s `markdown`: standard Markdown, which the adapter renders in the platform's markup. Mentions in it notify nobody. |
| `username` | Dropped: `effect/chat` posts as the bot's own identity. |
| result `id` | The platform's message id, always `some`. |

`effect/chat` takes standard Markdown where an incoming webhook takes the vendor's own markup, so Slack `mrkdwn` such as `*bold*` reads as italic here: write `**bold**`.

`sendBatch` posts one message at a time, in order, and stops at the first failure; an empty batch posts nothing.

## Errors

Every `ChatError` becomes a `ChatSendError` with `provider` set to the platform, `status: none`, and the `ChatError`'s own message, built from the platform, op, reason and the reason's redacted `detail` (`slack.post: NotFound: channel_not_found`). The `ChatError` is not kept as the `cause`: its reason's cause is unredacted and can hold ids and payload values. A message over the platform's length fails `TooLarge` before any request, and a thread on a platform with no adapter registered fails `NoAdapter`.

The adapter's own retry policy applies (it retries only what is safe to send again); wrap a send in `Chat.withoutRetries` to make one attempt.

## Testing

`ChatTest.layer()` is an in-memory adapter. It knows only the threads it made, so build the bridge on one:

```ts
import * as Effect from "effect/Effect";
import * as ChatTest from "effect/chat/ChatTest";
import * as EffectChat from "@thomasfosterau/effect-connect-effect-chat";

const program = Effect.gen(function* () {
  const fake = yield* ChatTest.ChatTest;
  const thread = yield* fake.makeThread();
  const chat = yield* EffectChat.make({ thread });
  yield* chat.send({ text: "Deploy finished" });
  return yield* fake.messages(thread); // what the thread now shows
}).pipe(Effect.provide(ChatTest.layer()));
```

For code that only needs to see what it sent, `ChatService.layerRecording` from the core needs no adapter at all.
