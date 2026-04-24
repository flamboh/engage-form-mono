# fm-gacha Runtime Reference

Reference copied from `/Users/olive/Code/fm-gacha` for the Engage Form Convex/Clerk setup.

## Dev Server

fm-gacha runs the web app and Convex together:

```json
{
  "dev": "concurrently -n web,convex -c blue,magenta \"vite dev --port 6873\" \"bunx convex dev\""
}
```

Engage Form adaptation:

```json
{
  "dev": "concurrently -n web,convex -c blue,magenta \"vp run web#dev -- --port 6873\" \"bunx convex dev\"",
  "dev:web": "vp run web#dev -- --port 6873",
  "dev:convex": "bunx convex dev"
}
```

## Client Provider Pattern

Source: `/Users/olive/Code/fm-gacha/src/lib/convex.tsx`

```tsx
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/tanstack-react-start";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL");
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
```

## Root Provider Pattern

Source: `/Users/olive/Code/fm-gacha/src/routes/__root.tsx`

Provider order:

1. `ClerkProvider` gets `VITE_CLERK_PUBLISHABLE_KEY`.
2. App document renders.
3. `ConvexClientProvider` wraps routes/components inside the document body.

Key behavior:

- Missing `VITE_CLERK_PUBLISHABLE_KEY` throws.
- Missing `VITE_CONVEX_URL` throws.
- Convex auth uses Clerk's `useAuth`.

## Convex Auth Config

Source: `/Users/olive/Code/fm-gacha/convex/auth.config.ts`

```ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
```

Convex dashboard needs `CLERK_JWT_ISSUER_DOMAIN`.

## Env Vars

Use these names:

- `CONVEX_DEPLOYMENT`
- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_FRONTEND_API_URL`
- `CLERK_JWT_ISSUER_DOMAIN`

## Dependencies To Add When Wiring Auth

Web app:

- `@clerk/tanstack-react-start`
- `convex`

Convex backend:

- `convex`

Tests later:

- `convex-test`
- `@clerk/testing`
