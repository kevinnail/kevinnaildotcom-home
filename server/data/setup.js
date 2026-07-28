import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default (pool) => {
  return fs
    .readFile(path.join(currentDirectory, '..', 'sql', 'setup.sql'), { encoding: 'utf-8' })
    .then((sql) => pool.query(sql))
    .then(() => {
      if (process.env.NODE_ENV !== 'test') {
        console.info('✅ Database setup complete!');
      }
    })
    .catch((error) => {
      const databaseNotFound = error.message.match(/database "(.+)" does not exist/i);

      if (databaseNotFound) {
        const [message, databaseName] = databaseNotFound;
        console.error('❌ Error: ' + message);
        console.info(`Try running \`createdb -U postgres ${databaseName}\` in your terminal`);
      } else {
        console.error(error);
        console.error('❌ Error: ' + error.message);
      }
    });
};
