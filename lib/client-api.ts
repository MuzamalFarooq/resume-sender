export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type ApiFailure = {
  error?: {
    message?: string;
  };
};

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiClientError("Could not reach the server. Check your connection and try again.", 0);
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new ApiClientError("The server returned an invalid response.", response.status);
  }

  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof (result as ApiFailure).error?.message === "string"
        ? (result as ApiFailure).error?.message
        : "The request could not be completed.";
    throw new ApiClientError(message ?? "The request could not be completed.", response.status);
  }

  if (
    typeof result !== "object" ||
    result === null ||
    !("data" in result)
  ) {
    throw new ApiClientError("The server returned an invalid response.", response.status);
  }

  return result.data as T;
}
