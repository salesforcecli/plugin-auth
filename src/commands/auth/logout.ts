/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { SfOrgs, AuthRemover, Global, Messages, Mode, SfdxError } from '@salesforce/core';
import { Prompts } from '../../prompts';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'logout');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export default class Logout extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly supportsUsername = true;
  public static aliases = ['force:auth:logout'];

  public static readonly flagsConfig: FlagsConfig = {
    all: flags.boolean({
      char: 'a',
      description: messages.getMessage('all'),
      longDescription: messages.getMessage('allLong'),
      required: false,
    }),
    noprompt: flags.boolean({
      char: 'p',
      description: commonMessages.getMessage('noPrompt'),
      required: false,
    }),
  };

  public async run(): Promise<string[]> {
    if (this.flags.targetusername && this.flags.all) {
      const err = new SfdxError(messages.getMessage('specifiedBothUserAndAllError'), 'SpecifiedBothUserAndAllError');
      return Promise.reject(err);
    }

    const remover = await AuthRemover.create();
    const authConfigs = await this.getLogoutAuths(remover);

    if (await this.shouldRunCommand(authConfigs)) {
      const usernames = Object.keys(authConfigs);
      if (this.shouldFindAllAuths()) {
        await remover.removeAllAuths();
      } else {
        await remover.removeAuth(usernames[0]);
      }
      this.ux.log(messages.getMessage('logoutOrgCommandSuccess', [usernames.join(os.EOL)]));
      return usernames;
    }
    return [];
  }

  private async getLogoutAuths(remover: AuthRemover): Promise<SfOrgs> {
    if (this.shouldFindAllAuths()) {
      return remover.findAllAuths();
    }
    const authConfig = await remover.findAuth(this.flags.targetusername);
    return { [authConfig.username]: authConfig } as SfOrgs;
  }

  private shouldFindAllAuths(): boolean {
    return !!this.flags.all || (!this.flags.targetusername && Global.getEnvironmentMode() === Mode.DEMO);
  }

  private async shouldRunCommand(authConfigs: SfOrgs): Promise<boolean> {
    const orgsToDelete = [[Object.keys(authConfigs)].join(os.EOL)];
    const message = messages.getMessage('logoutCommandYesNo', orgsToDelete);
    return Prompts.shouldRunCommand(this.ux, this.flags.noprompt, message);
  }
}
