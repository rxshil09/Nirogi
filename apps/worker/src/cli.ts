import 'dotenv/config';
import { RetailerSlugSchema } from '@nirogi/contracts';
import { SharedBrowser } from './lib/browser.js';
import { getAdapter } from './adapters/index.js';

const argumentValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const main = async (): Promise<void> => {
  const source = RetailerSlugSchema.parse(argumentValue('--source'));
  const query = argumentValue('--query')?.trim();
  const pincode = argumentValue('--pincode')?.trim();

  if (!query) {
    throw new Error('Use --query to provide a medicine name.');
  }

  const browser = new SharedBrowser();
  await browser.launch();

  try {
    const offer = await getAdapter(source).search({ query, pincode, browser });
    process.stdout.write(`${JSON.stringify({ source, query, offer }, null, 2)}\n`);
  } finally {
    await browser.close();
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown worker error.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
