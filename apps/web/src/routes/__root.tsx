import { ClerkProvider } from "@clerk/tanstack-react-start";
import type { ReactNode } from "react";
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import appCss from "../style.css?url";
import { ConvexClientProvider } from "../lib/convex.tsx";
import { appEnv } from "../lib/env.ts";
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: appEnv.appName },
      { name: "description", content: appEnv.appDescription },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

function RootComponent() {
  return (
    <ClerkProvider publishableKey={appEnv.clerkPublishableKey}>
      <RootDocument>
        <Outlet />
      </RootDocument>
    </ClerkProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Not found</CardTitle>
          <CardDescription>That route does not exist.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/" />}>Return home</Button>
        </CardContent>
      </Card>
    </main>
  );
}
