import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  retryCount: number = 0
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    // Handle 401 Unauthorized - try to refresh session
    if (res.status === 401 && retryCount === 0) {
      console.log('[API] Session expired, attempting refresh...');

      try {
        // Try to refresh session
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshResponse.ok) {
          console.log('[API] Session refreshed, retrying request');
          // Retry original request with refreshed session
          return apiRequest(method, url, data, retryCount + 1);
        } else {
          // Refresh failed, redirect to login
          console.error('[API] Session refresh failed, redirecting to login');
          window.location.href = '/login';
          throw new Error('Session expired');
        }
      } catch (error) {
        console.error('[API] Session refresh error:', error);
        window.location.href = '/login';
        throw error;
      }
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // Re-throw the error to allow proper error handling
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 0, // FORCE REFRESH - no caching of stale data
      retry: 1, // Allow one retry
    },
    mutations: {
      retry: false,
    },
  },
});
