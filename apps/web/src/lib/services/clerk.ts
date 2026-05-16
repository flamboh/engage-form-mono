import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { createClerkClient, type User } from "@clerk/backend";
import type { RequestEvent } from "@sveltejs/kit";
import { Context, Data, Effect, Layer } from "effect";

export class ClerkError extends Data.TaggedError("ClerkError")<{
  readonly message: string;
  readonly kind: string;
  readonly traceId: string;
  readonly timestamp: number;
  readonly cause?: unknown;
}> {}

interface ClerkDef {
  validateAuth: (event: RequestEvent) => Effect.Effect<User, ClerkError>;
}

export class ClerkService extends Context.Tag("ClerkService")<ClerkService, ClerkDef>() {
  static readonly layer = Layer.sync(ClerkService, () => {
    const clerk = createClerkClient({
      secretKey: readRequiredEnv(privateEnv, "CLERK_SECRET_KEY"),
      publishableKey: readRequiredEnv(publicEnv, "PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });

    const validateAuth = (event: RequestEvent) =>
      Effect.gen(function* () {
        const { request } = event;

        const auth = yield* Effect.tryPromise({
          try: () => clerk.authenticateRequest(request).then((state) => state.toAuth()),
          catch: (e) =>
            new ClerkError({
              message: e instanceof Error ? e.message : "Unknown error",
              kind: "AuthenticationError",
              traceId: crypto.randomUUID(),
              timestamp: Date.now(),
              cause: e,
            }),
        });

        if (!auth || !auth.isAuthenticated) {
          return yield* Effect.fail(
            new ClerkError({
              message: "Unauthorized",
              kind: "AuthenticationError",
              traceId: crypto.randomUUID(),
              timestamp: Date.now(),
              cause: new Error("Unauthorized"),
            }),
          );
        }

        const user = yield* Effect.tryPromise({
          try: () => clerk.users.getUser(auth.userId),
          catch: (e) =>
            new ClerkError({
              message: e instanceof Error ? e.message : "Unknown error",
              kind: "AuthenticationError",
              traceId: crypto.randomUUID(),
              timestamp: Date.now(),
              cause: e,
            }),
        });

        return user;
      });

    return {
      validateAuth,
    };
  });
}

function readRequiredEnv(source: Record<string, string | undefined>, key: string) {
  const value = source[key]?.trim();

  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
}
