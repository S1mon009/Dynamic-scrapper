import { main } from '../dist/cli/index.js';

main(process.argv).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
