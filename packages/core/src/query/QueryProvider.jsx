import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Smart TV defaults: evitar refetch agresivo y picos de CPU/red.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    },
  },
});

export function AppQueryProvider({ children }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export default AppQueryProvider;

