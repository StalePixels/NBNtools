import { PersonalServer } from './PersonalServer.js';
import { startServer } from './lib/start.js';

// Settings in a .env file in the current folder. An environment variable
//    that is already set wins over the same name in the file.
try {
    process.loadEnvFile();
} catch (err) {
    if (!(err instanceof Error && 'code' in err && err.code === 'ENOENT')) {
        throw err;
    }
}

// With NBN_RETRY=0, a busy port ends the process. It must exit as a failure.
startServer(PersonalServer).on('error', () => {
    process.exitCode = 1;
});
