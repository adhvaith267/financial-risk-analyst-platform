import { createFileRoute, redirect } from "@tanstack/react-router";

/** Every unknown route redirects to the landing page. */
export const Route = createFileRoute("/$")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
