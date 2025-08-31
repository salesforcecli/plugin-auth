/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Logger, SfdcUrl, SfProject, Messages, SfError, Global, Mode } from '@salesforce/core';
import { getString, isObject } from '@salesforce/ts-types';
import { prompts, StandardColors } from '@salesforce/sf-plugins-core';

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
  const url = new SfdcUrl(urlString);
  if (url.isLightningDomain() || (url.isInternalUrl() && url.origin.includes('.lightning.'))) {
    throw new SfError(messages.getMessage('lightningInstanceUrl'), 'LightningDomain', [
      messages.getMessage('flags.instance-url.description'),
    ]);
  }
};

const shouldExitCommand = async (noPrompt?: boolean): Promise<boolean> =>
  Boolean(noPrompt) || Global.getEnvironmentMode() !== Mode.DEMO
    ? false
    : !(await prompts.confirm({ message: StandardColors.info(messages.getMessage('warnAuth', ['sf'])), ms: 60_000 }));

export default {
  shouldExitCommand,
  resolveLoginUrl,
};
