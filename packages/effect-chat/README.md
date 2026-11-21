# `@thomasfosterau/effect-connect-effect-chat`

A `ChatService` for [`@thomasfosterau/effect-connect`](https://github.com/thomasfosterau/effect-connect/tree/trunk/packages/core#readme) over Effect's own [`effect/chat`](https://github.com/Effect-TS/effect-smol) router, so `sendChat` posts through `@effect/chat-slack`, `@effect/chat-discord` or any other `effect/chat` adapter.

> [!WARNING]
> Experimental and pre-1.0, largely written with Claude Code; the API may change without notice. Not production-ready. `effect/chat` is itself marked unstable upstream.

## Install

```bash
pnpm add @thomasfosterau/effect-connect-effect-chat @thomasfosterau/effect-connect effect @effect/chat-slack
```

`effect` (`^4.1.5`, the release that added `effect/chat`) is a required peer dependency. Node.js 22 or newer.

## Example

```ts
import * as Effect from "effect/Effect";
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

const ChatLive = EffectChat.layer({ thread: ChatThread.make("slack", "T1/C1") }).pipe(
  Layer.provide(SlackLive),
);

const program = sendChat({ text: "Deploy **finished**" }); // result.id is Slack's message id
```

## Entry points

| Export | Purpose |
| --- | --- |
| `layer(options)` | The `ChatService` over the `Chat` router in context, posting to `options.thread`. |
| `make(options)` | The same service as an `Effect`, for composing by hand. |
| `toChatSendError` | The `ChatError` to `ChatSendError` mapping. |
| `EffectChatOptions` | `{ thread }`: the `effect/chat` address every message goes to. |

## Documentation

- [effect-chat reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/effect-chat.md): message mapping, errors, testing.
- [Core reference](https://github.com/thomasfosterau/effect-connect/blob/trunk/docs/core.md)
- [Repository README](https://github.com/thomasfosterau/effect-connect/blob/trunk/README.md)

## License

[MIT](https://github.com/thomasfosterau/effect-connect/blob/trunk/LICENSE.md)
