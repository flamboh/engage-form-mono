import { randomUUID } from "node:crypto";
import { Cause, Data, Effect, Exit, ManagedRuntime } from "effect";
import { error } from "@sveltejs/kit";
import { ClerkError, ClerkService } from "./services/clerk";

const appLayer = ClerkService.layer;

export const runtime = ManagedRuntime.make(appLayer);

export class GenericError extends Data.TaggedError("GenericError")<{
  readonly message: string;
  readonly status: number;
  readonly kind: string;
  readonly timestamp: number;
  readonly traceId: string;
  readonly cause?: unknown;
}> {}

export const createGenericError = ({
  message,
  status,
  kind,
  cause,
}: {
  message: string;
  status: number;
  kind: string;
  cause?: unknown;
}) =>
  new GenericError({
    message,
    status,
    kind,
    timestamp: Date.now(),
    traceId: randomUUID(),
    cause,
  });

const serializeUnknown = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: value.cause === undefined ? undefined : serializeUnknown(value.cause),
    };
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return Object.prototype.toString.call(value);
  }
};

const toPublicError = (
  errorValue: Pick<GenericError | ClerkError, "message" | "kind" | "timestamp" | "traceId">,
) => ({
  message: errorValue.message,
  kind: errorValue.kind,
  timestamp: errorValue.timestamp,
  traceId: errorValue.traceId,
});

const logTaggedError = (errorValue: GenericError | ClerkError) => {
  if (errorValue instanceof ClerkError) {
    console.error("Clerk error", {
      traceId: errorValue.traceId,
      kind: errorValue.kind,
      timestamp: errorValue.timestamp,
      message: errorValue.message,
      cause: serializeUnknown(errorValue.cause),
    });

    return;
  }

  console.error("Application error", {
    traceId: errorValue.traceId,
    kind: errorValue.kind,
    timestamp: errorValue.timestamp,
    status: errorValue.status,
    message: errorValue.message,
    cause: serializeUnknown(errorValue.cause),
  });
};

export const effectRunner = async <T>(
  effect: Effect.Effect<T, GenericError | ClerkError, ClerkService>,
) => {
  const exit = await runtime.runPromiseExit(effect);

  if (Exit.isFailure(exit)) {
    const cause = exit.cause;

    console.error("Effect failure", {
      cause: Cause.pretty(cause),
      defects: Array.from(Cause.defects(cause), serializeUnknown),
      interruptors: Array.from(Cause.interruptors(cause), serializeUnknown),
    });

    const firstError = Cause.failureOption(cause);
    if (firstError._tag === "Some") {
      if (firstError.value instanceof ClerkError) {
        return error(401, toPublicError(firstError.value));
      }

      if (firstError.value instanceof GenericError) {
        return error(firstError.value.status, toPublicError(firstError.value));
      }
    }

    const unknownError = createGenericError({
      message: "An unknown error occurred",
      status: 500,
      kind: "unknown_error",
      cause,
    });

    logTaggedError(unknownError);

    return error(unknownError.status, toPublicError(unknownError));
  }

  return exit.value;
};
