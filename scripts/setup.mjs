import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const target = new URL('../.env', import.meta.url);
try {
  await writeFile(target, [
    `POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}`,
    `API_TOKEN=${randomBytes(32).toString('hex')}`,
    'API_PORT=3000', '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('.env créé. Les secrets ne sont pas affichés.');
} catch (error) {
  if (error.code === 'EEXIST') console.log('.env existe déjà : aucune modification.');
  else throw error;
}
