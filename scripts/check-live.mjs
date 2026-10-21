// Post-deployment check (read-only job of deploy.yml): the live site must be the verified commit.
// Usage: node scripts/check-live.mjs <site url> <commit>. GitHub Pages can take a few minutes to serve new files, so retry.
import { checkLive } from './live-check.mjs';

const [baseUrl, commit] = process.argv.slice(2);
if (!baseUrl || !/^[0-9a-f]{40}$/.test(commit ?? '')) {
  console.error('Usage: node scripts/check-live.mjs <site url> <40-character commit id>');
  process.exit(2);
}
const ATTEMPTS = 12;
const WAIT_MS = 20_000;
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const problems = await checkLive({ baseUrl, commit });
  if (problems.length === 0) {
    console.log(`Live site ${baseUrl} serves commit ${commit} and is installable (attempt ${attempt}).`);
    process.exit(0);
  }
  console.log(`Attempt ${attempt}/${ATTEMPTS}: ${problems.length} problem(s)`);
  for (const p of problems) console.log(`  - ${p}`);
  if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
}
console.error('The live site does not match the verified build.');
process.exit(1);
