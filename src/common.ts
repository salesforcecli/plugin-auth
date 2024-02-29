/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Logger, SfdcUrl, SfProject, Messages, SfError, Global, Mode } from '@salesforce/core';
import { getString, isObject } from '@salesforce/ts-types';
import chalk from 'chalk';
import { prompts } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

const resolveLoginUrl = async (instanceUrl?: string): Promise<string> => {
  const logger = await Logger.child('Common', { tag: 'resolveLoginUrl' });
  const loginUrl = instanceUrl ?? (await getLoginUrl(logger));
  throwIfLightning(loginUrl);
  logger.debug(`loginUrl: ${loginUrl}`);
  return loginUrl;
};

/** try to get url from project if there is one, otherwise use the default production URL  */
const getLoginUrl = async (logger: Logger): Promise<string> => {
  try {
    const project = await SfProject.resolve();
    const projectJson = await project.resolveProjectConfig();
    return getString(projectJson, 'sfdcLoginUrl', SfdcUrl.PRODUCTION);
  } catch (err) {
    const message: string = (isObject(err) ? Reflect.get(err, 'message') ?? err : err) as string;
    logger.debug(`error occurred while trying to determine loginUrl: ${message}`);
    return SfdcUrl.PRODUCTION;
  }
};
const throwIfLightning = (urlString: string): void => {
  if (new SfdcUrl(urlString).isLightningDomain()) {
    throw new SfError(messages.getMessage('lightningInstanceUrl'), 'LightningDomain', [
      messages.getMessage('flags.instance-url.description'),
    ]);
  }
};

const shouldExitCommand = async (noPrompt?: boolean): Promise<boolean> =>
  Boolean(noPrompt) || Global.getEnvironmentMode() !== Mode.DEMO
    ? false
    : !(await prompts.confirm({ message: chalk.dim(messages.getMessage('warnAuth', ['sf'])), ms: 60_000 }));

export default {
  shouldExitCommand,
  resolveLoginUrl,
};
