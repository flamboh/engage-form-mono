import { ConvexPrivateService } from "$lib/services/convex";
import { Effect } from "effect";
import { api } from "$convex/_generated/api";
import { getRequestEvent, query } from "$app/server";
import { ClerkService } from "$lib/services/clerk";
import type { RequestEvent } from "@sveltejs/kit";
import { effectRunner } from "$lib/runtime";

const demoRemote = Effect.gen(function* () {
  const convex = yield* ConvexPrivateService;

  const res = yield* convex.query({
    func: api.private.demo.privateDemoQuery,
    args: {
      username: "hello there",
    },
  });

  return res;
});

export const remoteDemoQuery = query(async () => {
  const res = await effectRunner(demoRemote);

  return res;
});

const demoAuthed = (event: RequestEvent) =>
  Effect.gen(function* () {
    const clerk = yield* ClerkService;

    const user = yield* clerk.validateAuth(event);

    return user;
  });

export const remoteAuthedDemoQuery = query(async () => {
  const event = getRequestEvent();

  const res = await effectRunner(demoAuthed(event));

  return {
    user: {
      id: res.id,
      email: res.primaryEmailAddress?.emailAddress ?? null,
    },
  };
});
