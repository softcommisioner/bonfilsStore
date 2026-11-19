import { config } from './config.js';
import { bootstrap } from './app.js';
import { getStore } from './db/index.js';

const isDirectRun = Boolean(process.argv[1] && /(^|[\\/])server([\\/]index)?\.ts$/.test(process.argv[1]));

if (isDirectRun) {
  bootstrap()
    .then(app => {
      const server = app.listen(config.port, '0.0.0.0', () => {
        console.log(`\n  BONFILS STORE API listening on http://localhost:${config.port}\n`);
      });
      const shutdown = () => {
        server.close(() => {
          void getStore().close().finally(() => process.exit(0));
        });
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    })
    .catch(error => {
      console.error('[api] failed to start', error);
      process.exit(1);
    });
}

export { bootstrap };
