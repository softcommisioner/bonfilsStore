import { config } from './config';
import { bootstrap } from './app';

const isDirectRun = Boolean(process.argv[1] && /(^|[\\/])server([\\/]index)?\.ts$/.test(process.argv[1]));

if (isDirectRun) {
  bootstrap()
    .then(app => {
      app.listen(config.port, '0.0.0.0', () => {
        console.log(`\n  BONFILS STORE API listening on http://localhost:${config.port}\n`);
      });
    })
    .catch(error => {
      console.error('[api] failed to start', error);
      process.exit(1);
    });
}

export { bootstrap };
