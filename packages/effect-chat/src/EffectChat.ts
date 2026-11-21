/**
 * The core `ChatService` over Effect's own `effect/chat` router: each message
 * is a `Chat.post` to one configured thread, so whichever `effect/chat`
 * adapter is registered for that thread's platform delivers it.
 *
 * @module EffectChat
 * @since 0.1.0
 */

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Chat from "effect/chat/Chat";
import type * as ChatError from "effect/chat/ChatError";
import type * as ChatThread from "effect/chat/ChatThread";
import {
  ChatSendError,
  ChatService,
  type ChatMessage,
  type ChatSendResult,
} from "@thomasfosterau/effect-connect";

/**
 * What the bridge is configured with: the `effect/chat` address every
 * message goes to (`ChatThread.make("slack", "T1/C1")`, or a
 * `{platform}:{id}` string read through `ChatThread.FromString`).
 *
 * @since 0.1.0
 */
export interface EffectChatOptions {
  readonly thread: ChatThread.ChatThread;
}

/**
 * The `ChatSendError` for an `effect/chat` failure. `provider` is the
 * platform; the message is the `ChatError`'s own, built from the platform,
 * op, reason and its redacted `detail`. The `ChatError` is not kept as the
 * cause, because its reason's cause is unredacted and can hold ids and
 * payload values.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as ChatError from "effect/chat/ChatError";
 * import { toChatSendError } from "@thomasfosterau/effect-connect-effect-chat";
 *
 * const error = toChatSendError(
 *   new ChatError.ChatError({
 *     platform: "slack",
 *     op: "post",
 *     reason: new ChatError.NotFound({ detail: "channel_not_found" }),
 *   }),
 * );
 *
 * assert.strictEqual(error.provider, "slack");
 * assert.strictEqual(error.message, "slack.post: NotFound: channel_not_found");
 * ```
 *
 * @since 0.1.0
 */
export const toChatSendError = (error: ChatError.ChatError): ChatSendError =>
  new ChatSendError({
    provider: error.platform,
    message: error.message,
    status: Option.none(),
  });

/**
 * Build the `ChatService` over the `Chat` router in context.
 *
 * - `send` posts `text` as `effect/chat`'s standard Markdown, which the
 *   adapter renders in the platform's own markup; mentions in it notify
 *   nobody. `username` is dropped: `effect/chat` posts as the bot's own
 *   identity. The result's `id` is the platform's message id.
 * - `sendBatch` posts one message at a time, in order, and stops at the
 *   first failure.
 * - The adapter's own retry policy applies (`ChatAdapter.retrySafe`), and
 *   `Chat.withoutRetries` around a send turns it off.
 *
 * @since 0.1.0
 */
export const make = (
  options: EffectChatOptions,
): Effect.Effect<ChatService["Service"], never, Chat.Chat> =>
  Effect.gen(function* () {
    const chat = yield* Chat.Chat;

    const send = (message: ChatMessage): Effect.Effect<ChatSendResult, ChatSendError> =>
      chat.post(options.thread, { markdown: message.text }).pipe(
        Effect.map((posted): ChatSendResult => ({ id: Option.some(posted.id) })),
        Effect.mapError(toChatSendError),
      );

    return ChatService.of({
      send,
      sendBatch: (messages) => Effect.forEach(messages, send, { concurrency: 1 }),
    });
  });

/**
 * The `ChatService` over the `Chat` router in context. Provide `Chat.layer`
 * with an adapter layer on top (`SlackChat.layer`, `DiscordChat.layer`, or
 * `ChatTest.layer` in a test).
 *
 * @example
 * ```ts
 * import * as assert from "node:assert";
 * import * as Effect from "effect/Effect";
 * import * as Option from "effect/Option";
 * import * as ChatTest from "effect/chat/ChatTest";
 * import { sendChat } from "@thomasfosterau/effect-connect";
 * import * as EffectChat from "@thomasfosterau/effect-connect-effect-chat";
 *
 * // `ChatTest.layer` is an in-memory adapter; in production, `Chat.layer`
 * // with `SlackChat.layer` or `DiscordChat.layer` on top.
 * const program = Effect.gen(function* () {
 *   const fake = yield* ChatTest.ChatTest;
 *   const thread = yield* fake.makeThread();
 *   const result = yield* sendChat({ text: "Deploy finished" }).pipe(
 *     Effect.provide(EffectChat.layer({ thread })),
 *   );
 *   const [shown] = yield* fake.messages(thread);
 *   assert.deepStrictEqual(result.id, Option.some(shown!.id));
 * });
 *
 * Effect.runSync(program.pipe(Effect.provide(ChatTest.layer())));
 * ```
 *
 * @since 0.1.0
 */
export const layer = (options: EffectChatOptions): Layer.Layer<ChatService, never, Chat.Chat> =>
  Layer.effect(ChatService, make(options));
