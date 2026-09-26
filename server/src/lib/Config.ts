import * as fs from 'node:fs';
import * as path from 'node:path';
import { log } from './Logger.js';

export interface Config {
  readonly BACKLOG: number;
  readonly FILEPATH: string;
  readonly IP: string;
  readonly PORT: number;
  readonly RETRY: number;
  readonly SHOWDOTS: boolean;
}

const defaultConfig = {
  BACKLOG: 128,
  FILEPATH: 'public',
  IP: '0.0.0.0',
  PORT: 48128,
  RETRY: 1000,
  SHOWDOTS: false
};

const getConfig = (paramName: keyof typeof defaultConfig): string | undefined => {
  const value = process.env[`NBN_${paramName}`];
  return value ? value : undefined;
};

const checkPath = (userPath: string): string => {
  const publicPath = path.resolve(userPath);

  if(!fs.existsSync(publicPath)) {
    log(`ERROR: public path (${publicPath}) does not exist`);
    process.exit(-1);
  }

  return publicPath;
};

export const loadConfig = (): Config => ({
  BACKLOG: Number(getConfig('BACKLOG') ?? defaultConfig.BACKLOG),
  FILEPATH: checkPath(getConfig('FILEPATH') ?? defaultConfig.FILEPATH),
  IP: getConfig('IP') ?? defaultConfig.IP,
  PORT: Number(getConfig('PORT') ?? defaultConfig.PORT),
  RETRY: Number(getConfig('RETRY') ?? defaultConfig.RETRY),
  SHOWDOTS: (getConfig('SHOWDOTS') ?? String(defaultConfig.SHOWDOTS)) === 'true',
});
