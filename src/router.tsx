import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Kleine Zeitabweichung zwischen Gerät und Server lässt frisch ausgestellte
// Tokens kurzzeitig als "in der Zukunft ausgestellt" gelten. Das löst sich
// nach wenigen Sekunden von selbst — deshalb kurz warten und erneut versuchen.
function isTransientAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /issued at future|Invalid token|Unauthorized/i.test(message);
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => isTransientAuthError(error) && failureCount < 4,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
