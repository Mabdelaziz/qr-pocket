// Writes dist/version.json (SPEC-005). Run in CI after `npm run build`, before the tests, so the tested bytes are the deployed bytes.
import { writeStamp } from './public-files.mjs';

const stamp = writeStamp('dist');
console.log(`dist/version.json: ${JSON.stringify(stamp)}`);
