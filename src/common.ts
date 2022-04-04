/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Logger, SfdcUrl, SfProject, Messages, SfError } from '@salesforce/core';
import { getString, isObject, Optional } from '@salesforce/ts-types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

interface Flags {
  setalias?: string;
  setdefaultdevhubusername?: boolean;
  setdefaultusername?: boolean;
}

export class Common {
  public static async handleSideEffects(authInfo: AuthInfo, flags: Flags): Promise<void> {
    if (flags.setalias) await authInfo.setAlias(flags.setalias);

    if (flags.setdefaultdevhubusername || flags.setdefaultusername) {
      if (flags.setdefaultdevhubusername) {
        await authInfo.save({ isDevHub: true });
      }
      await authInfo.setAsDefault({
        org: flags.setdefaultusername,
        devHub: flags.setdefaultdevhubusername,
      });
    }
  }
  public static async resolveLoginUrl(instanceUrl: Optional<string>): Promise<Optional<string>> {
    const logger = await Logger.child('Common', { tag: 'resolveLoginUrl' });
    if (instanceUrl) {
      if (instanceUrl.includes('lightning.force.com')) {
        logger.warn(messages.getMessage('invalidInstanceUrl'));
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
    if (loginUrl.includes('lightning.force.com')) {
      logger.warn(messages.getMessage('invalidInstanceUrl'));
      throw new SfError(messages.getMessage('invalidInstanceUrl'), 'URL_WARNING');
    }
    logger.debug(`loginUrl: ${loginUrl}`);
    return loginUrl;
  }
}
