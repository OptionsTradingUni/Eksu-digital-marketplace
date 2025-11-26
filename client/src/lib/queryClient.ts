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
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL from primitive parts of queryKey, and extract query params from objects
    const urlParts: string[] = [];
    const queryParams = new URLSearchParams();
    
    for (const part of queryKey) {
      if (typeof part === "string" || typeof part === "number" || typeof part === "boolean") {
        // Include primitives (strings, numbers, booleans) in the URL path
        urlParts.push(String(part));
      } else if (typeof part === "object" && part !== null) {
        // Convert object to query parameters
        for (const [key, value] of Object.entries(part)) {
          if (value !== undefined && value !== null && value !== "") {
            queryParams.append(key, String(value));
          }
        }
      }
    }
    
    let url = urlParts.join("/");
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    const res = await fetch(url, {
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
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000,
      gcTime: 300000,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
