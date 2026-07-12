import { toast } from "sonner";
import { ApiError } from "./api-client";

export function handleApiError(context: string, error: unknown): void {
  if (error instanceof ApiError) {
    const prefix = `[${context}]`;
    if (error.status === 400) toast.error(`${prefix} Bad request: ${error.message}`);
    else if (error.status === 404) toast.error(`${prefix} Not found: ${error.message}`);
    else if (error.status === 409) toast.error(`${prefix} Conflict: ${error.message}`);
    else if (error.status === 422) toast.error(`${prefix} Validation error: ${error.message}`);
    else if (error.status === 503) toast.error(`${prefix} Service unavailable. Retry shortly.`);
    else toast.error(`${prefix} Server error (${error.status}): ${error.message}`);
    return;
  }
  if (error instanceof TypeError) {
    toast.error(`Network error — cannot reach the server. Check your connection.`, {
      action: { label: "Dismiss", onClick: () => {} },
    });
    return;
  }
  toast.error(`Unexpected error in ${context}.`);
  console.error(error);
}
