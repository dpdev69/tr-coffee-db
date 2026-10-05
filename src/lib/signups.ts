/** The one setting that decides whether the site collects emails. A deployment setting (wrangler var `SIGNUPS_ENABLED`),
 * like DEPLOYMENT_STAGE: never read from cookies or headers, because pages are cached at the edge for everyone.
 * Absent or anything but "true" means off, so a new environment cannot start collecting emails by accident.
 * Pass the Worker env where one exists (the endpoint); pages read the runtime process.env. Server-only: never import from a client component. */
export function signupsEnabled(env?: { SIGNUPS_ENABLED?: string }): boolean {
  return (env ? env.SIGNUPS_ENABLED : process.env.SIGNUPS_ENABLED) === 'true';
}
