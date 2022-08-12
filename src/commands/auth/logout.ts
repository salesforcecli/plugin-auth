/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { AuthRemover, Global, Messages, Mode, OrgConfigProperties, SfError } from '@salesforce/core';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
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
      throw new SfError(messages.getMessage('specifiedBothUserAndAllError'), 'SpecifiedBothUserAndAllError');
    }

    const remover = await AuthRemover.create();

    const targetUsername = this.flags.targetusername
      ? (this.flags.targetusername as string)
      : (this.configAggregator.getInfo(OrgConfigProperties.TARGET_ORG).value as string);
    let usernames: string[];
    try {
      usernames = this.shouldFindAllAuths()
        ? Object.keys(remover.findAllAuths())
        : [(await remover.findAuth(targetUsername)).username];
    } catch (e) {
      // keep the error name the same for SFDX
      const err = e as Error;
      err.name = 'NoOrgFound';
      throw SfError.wrap(err);
    }

    if (await this.shouldRunCommand(usernames)) {
      for (const username of usernames) {
        // run sequentially to avoid configFile concurrency issues
        // eslint-disable-next-line no-await-in-loop
        await remover.removeAuth(username);
      }
      this.ux.log(messages.getMessage('logoutOrgCommandSuccess', [usernames.join(os.EOL)]));
      return usernames;
    } else {
      return [];
    }
  }

  private shouldFindAllAuths(): boolean {
    return !!this.flags.all || (!this.flags.targetusername && Global.getEnvironmentMode() === Mode.DEMO);
  }

  private async shouldRunCommand(usernames: string[]): Promise<boolean> {
    const orgsToDelete = [usernames.join(os.EOL)];
    const message = messages.getMessage('logoutCommandYesNo', orgsToDelete);
    return Prompts.shouldRunCommand(this.ux, this.flags.noprompt as boolean, message);
  }
}
