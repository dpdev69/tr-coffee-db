/** One JSON line per failure on console.error, which Workers observability collects. Name and message only: no stack, no request data. */
export function logRouteError(route: string, error: unknown, extra?: Record<string, unknown>): void {
  const detail = error instanceof Error ? { name: error.name, message: error.message } : String(error);
  console.error(JSON.stringify({ event: 'route_error', route, error: detail, ...extra }));
}
