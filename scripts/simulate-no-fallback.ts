/**
 * Simulates the post-cutover state by forcing
 * `PERMISSIONS_FALLBACK_TO_ENV=false` and resolving every email through the
 * service. Confirms each known user still gets the same identity even when
 * env vars stop being a fallback.
 *
 * Stub the env vars before importing the service so it sees the override.
 */
process.env.PERMISSIONS_FALLBACK_TO_ENV = "false";

const emails = (() => {
  const raw = process.env.DASHBOARD_PERMISSIONS ?? "{}";
  try {
    return Object.keys(JSON.parse(raw));
  } catch {
    return [];
  }
})();

import("@/lib/permissions-service").then(async ({ getUserIdentity }) => {
  let problems = 0;
  console.log(`Simulating no-fallback for ${emails.length} emails\n`);
  for (const email of emails) {
    const identity = await getUserIdentity(email);
    if (!identity) {
      console.log(`✗ ${email} — would be locked out post-cutover`);
      problems++;
      continue;
    }
    if (identity.source !== "db") {
      console.log(
        `✗ ${email} — resolved via ${identity.source}, fallback should be disabled`,
      );
      problems++;
      continue;
    }
    console.log(`✓ ${email} — resolves via DB (${identity.role})`);
  }

  // Also probe an unknown email to ensure it's correctly rejected.
  const unknown = await getUserIdentity("nobody@nowhere.test");
  if (unknown) {
    console.log("\n✗ Unknown email returned an identity — env fallback still active");
    problems++;
  } else {
    console.log("\n✓ Unknown email correctly rejected (no env fallback)");
  }

  if (problems > 0) {
    console.error(`\n${problems} problem(s) in no-fallback simulation.`);
    process.exit(1);
  }
  console.log("\nNo-fallback simulation passes. Safe to flip the flag in prod.");
  process.exit(0);
});
