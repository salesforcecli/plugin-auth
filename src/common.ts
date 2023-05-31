/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger, SfdcUrl, SfProject, Messages, SfError } from '@salesforce/core';
import { getString, isObject } from '@salesforce/ts-types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export class Common {
  public static async resolveLoginUrl(instanceUrl?: string): Promise<string> {
    const logger = await Logger.child('Common', { tag: 'resolveLoginUrl' });
    if (instanceUrl) {
      if (instanceUrl.match(/lightning\..*force\.com/)) {
        throw new SfError(messages.getMessage('invalidInstanceUrl'), 'URL_WARNING');
      }
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
    if (loginUrl.match(/lightning\..*force\.com/)) {
      throw new SfError(messages.getMessage('invalidInstanceUrl'), 'URL_WARNING');
    }
    logger.debug(`loginUrl: ${loginUrl}`);
    return loginUrl;
  }
}
