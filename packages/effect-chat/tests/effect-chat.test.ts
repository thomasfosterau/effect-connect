// Every post goes to `ChatTest`'s in-memory adapter; nothing reaches a platform.

import { describe, expect, layer } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Chat from "effect/chat/Chat";
import * as ChatError from "effect/chat/ChatError";
import * as ChatTest from "effect/chat/ChatTest";
import * as ChatThread from "effect/chat/ChatThread";
import { ChatSendError, type ChatService } from "@thomasfosterau/effect-connect";
import * as EffectChat from "../src/index.ts";

class StubFailure extends Schema.TaggedError<StubFailure, { readonly brand: unique symbol }>()(
  "StubFailure",
  { message: Schema.String },
) {}

interface Fixture {
  readonly chat: ChatService["Service"];
  readonly fake: ChatTest.ChatTest["Service"];
  readonly thread: ChatThread.ChatThread;
  readonly calls: Effect.Effect<ReadonlyArray<ChatTest.Call>>;
}

// The fake only knows threads it made, so each test builds the bridge on a
// fresh one, and reads only that thread's calls. Retries are off, so one
// injected failure is one failed call.
const withBridge = <A, E>(
  body: (fixture: Fixture) => Effect.Effect<A, E>,
  thread?: ChatThread.ChatThread,
): Effect.Effect<A, E, ChatTest.ChatTest | Chat.Chat> =>
  Effect.gen(function* () {
    const fake = yield* ChatTest.ChatTest;
    const target = thread ?? (yield* fake.makeThread());
    const chat = yield* EffectChat.make({ thread: target });
    const calls = Effect.map(
      fake.calls,
      Arr.filter((call) => ChatThread.equals(call.thread, target)),
    );
    return yield* body({ chat, fake, thread: target, calls });
  }).pipe(Chat.withoutRetries);

describe("EffectChat", () => {
  layer(ChatTest.layer())((it) => {
    it.effect("posts the text to the configured thread and answers the message id", () =>
      withBridge(
        Effect.fnUntraced(function* ({ chat, fake, thread, calls }) {
          const result = yield* chat.send({ text: "Deploy **finished**", username: "CI" });

          const shown = yield* fake.messages(thread);
          expect(shown.map((m) => m.text)).toEqual(["Deploy **finished**"]);
          expect(result.id).toEqual(Option.map(Arr.head(shown), (m) => m.id));
          expect((yield* calls).map((c) => [c.op, c.markdown])).toEqual([
            ["post", "Deploy **finished**"],
          ]);
        }),
      ),
    );

    it.effect("posts a batch in order, one result per message", () =>
      withBridge(
        Effect.fnUntraced(function* ({ chat, fake, thread }) {
          const results = yield* chat.sendBatch([
            { text: "one" },
            { text: "two" },
            { text: "three" },
          ]);

          const shown = yield* fake.messages(thread);
          expect(shown.map((m) => m.text)).toEqual(["one", "two", "three"]);
          expect(results.map((r) => r.id)).toEqual(shown.map((m) => Option.some(m.id)));
        }),
      ),
    );

    it.effect("an empty batch posts nothing", () =>
      withBridge(
        Effect.fnUntraced(function* ({ chat, calls }) {
          expect(yield* chat.sendBatch([])).toEqual([]);
          expect(yield* calls).toEqual([]);
        }),
      ),
    );

    it.effect("stops a batch at the first failure", () =>
      withBridge(
        Effect.fnUntraced(function* ({ chat, fake, thread, calls }) {
          yield* fake.failNext("post", new ChatError.Forbidden({ detail: "not_in_channel" }));
          const exit = yield* chat.sendBatch([{ text: "one" }, { text: "two" }]).pipe(Effect.exit);

          expect(Exit.isFailure(exit)).toBe(true);
          expect(yield* fake.messages(thread)).toEqual([]);
          expect((yield* calls).map((c) => c.outcome)).toEqual(["Forbidden"]);
        }),
      ),
    );

    it.effect("maps a ChatError to a ChatSendError without its unredacted cause", () =>
      withBridge(
        Effect.fnUntraced(function* ({ chat, fake }) {
          yield* fake.failNext(
            "post",
            new ChatError.NotFound({
              detail: "channel_not_found",
              cause: new StubFailure({ message: "https://hooks.example.test/s3cr3t: secret text" }),
            }),
          );
          const error = yield* chat.send({ text: "secret text" }).pipe(Effect.flip);

          expect(error).toBeInstanceOf(ChatSendError);
          expect(error.provider).toBe("test");
          expect(error.message).toBe("test.post: NotFound: channel_not_found");
          expect(error.status).toEqual(Option.none());
          expect(error.cause).toBeUndefined();
        }),
      ),
    );

    it.effect("a thread on a platform with no adapter fails NoAdapter", () =>
      withBridge(
        Effect.fnUntraced(function* ({ chat }) {
          const error = yield* chat.send({ text: "hi" }).pipe(Effect.flip);
          expect(error.provider).toBe("slack");
          expect(error.message).toBe("slack.post: NoAdapter");
        }),
        ChatThread.make("slack", "T1/C1"),
      ),
    );
  });

  layer(ChatTest.layer({ limits: { messageLength: 10 } }))((it) => {
    it.effect("a message over the platform's limit fails before any post", () =>
      withBridge(
        Effect.fnUntraced(function* ({ chat, fake, thread }) {
          const error = yield* chat.send({ text: "x".repeat(11) }).pipe(Effect.flip);

          expect(error.message).toBe("test.post: TooLarge: message_too_long");
          expect(yield* fake.messages(thread)).toEqual([]);
        }),
      ),
    );
  });
});
