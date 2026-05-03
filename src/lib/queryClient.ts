import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 600_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // The app handles offline reads via IndexedDB (preferOfflineCaches) and
      // online/offline transitions via probeApiReachability. React Query's
      // default networkMode: "online" pauses queries when navigator.onLine is
      // false, which prevents the cache-first queryFn from even being called.
      networkMode: "always",
    },
    mutations: {
      // Same rationale: the Axios adapter + outbox queue handles offline writes.
      // Without this, useMutation.mutate() is a no-op when navigator.onLine is
      // false, so the user clicks Save and nothing happens.
      networkMode: "always",
    },
  },
});
