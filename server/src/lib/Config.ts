import * as fs from 'node:fs';
import * as path from 'node:path';
import { log } from './Logger.js';

export interface Config {
  readonly BACKLOG: number;
  readonly FILEPATH: string;
  readonly IDLE: number;
  readonly IP: string;
  readonly MAXCONNS: number;
  readonly MAXPERIP: number;
  readonly PORT: number;
  readonly RETRY: number;
  readonly SHOWDOTS: boolean;
}

// IDLE is in ms. A Next answers each block in well under a second, but a client
//    can keep its session open while its user reads a page, or while it unzips.
const defaultConfig = {
  BACKLOG: 128,
  FILEPATH: 'public',
  IDLE: 600000,
  IP: '0.0.0.0',
  MAXCONNS: 512,
  MAXPERIP: 16,
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
  IDLE: Number(getConfig('IDLE') ?? defaultConfig.IDLE),
  IP: getConfig('IP') ?? defaultConfig.IP,
  MAXCONNS: Number(getConfig('MAXCONNS') ?? defaultConfig.MAXCONNS),
  MAXPERIP: Number(getConfig('MAXPERIP') ?? defaultConfig.MAXPERIP),
  PORT: Number(getConfig('PORT') ?? defaultConfig.PORT),
  RETRY: Number(getConfig('RETRY') ?? defaultConfig.RETRY),
  SHOWDOTS: (getConfig('SHOWDOTS') ?? String(defaultConfig.SHOWDOTS)) === 'true',
});
