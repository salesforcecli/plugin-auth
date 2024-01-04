/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Logger, SfdcUrl, SfProject, Messages, SfError, Global, Mode } from '@salesforce/core';
import { getString, isObject } from '@salesforce/ts-types';
import chalk from 'chalk';
import confirm from '@inquirer/confirm';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

const resolveLoginUrl = async (instanceUrl?: string): Promise<string> => {
  const logger = await Logger.child('Common', { tag: 'resolveLoginUrl' });
  if (instanceUrl) {
    throwIfLightning(instanceUrl);
    return instanceUrl;
  }
  let loginUrl: string;
  try {
    const project = await SfProject.resolve();
    const projectJson = await project.resolveProjectConfig();
    loginUrl = getString(projectJson, 'sfdcLoginUrl', SfdcUrl.PRODUCTION);
  } catch (err) {
    const message: string = (isObject(err) ? Reflect.get(err, 'message') ?? err : err) as string;
    logger.debug(`error occurred while trying to determine loginUrl: ${message}`);
    loginUrl = SfdcUrl.PRODUCTION;
  }
  throwIfLightning(loginUrl);

  logger.debug(`loginUrl: ${loginUrl}`);
  return loginUrl;
};

const throwIfLightning = (urlString?: string): void => {
  if (urlString?.match(/\.lightning\..*force\.com/)) {
    throw new SfError(messages.getMessage('lightningInstanceUrl'), 'LightningDomain', [
      messages.getMessage('flags.instance-url.description'),
    ]);
  }
};

const shouldExitCommand = async (noPrompt?: boolean): Promise<boolean> =>
  Boolean(noPrompt) || Global.getEnvironmentMode() !== Mode.DEMO
    ? false
    : !(await confirm({ message: chalk.dim(messages.getMessage('warnAuth', ['sf'])) }));

export default {
  shouldExitCommand,
  resolveLoginUrl,
};
