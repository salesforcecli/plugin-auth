/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthRemover, Global, Messages, Mode, SfdxError } from '@salesforce/core';
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
    const removeAll = this.shouldFindAllAuths();

    const usernames: string[] = removeAll
      ? Object.values(remover.findAllAuths()).map((org) => org.username)
      : [this.flags.targetusername as string];

    if (await this.shouldRunCommand(usernames)) {
      for (const username of usernames) {
        await remover.removeAuth(username);
      }
      this.ux.log(messages.getMessage('logoutOrgCommandSuccess', [usernames.join(os.EOL)]));
      return usernames;
    }
    return [];
  }

  private shouldFindAllAuths(): boolean {
    return !!this.flags.all || (!this.flags.targetusername && Global.getEnvironmentMode() === Mode.DEMO);
  }

  private async shouldRunCommand(usernames: string[]): Promise<boolean> {
    const message = messages.getMessage('logoutCommandYesNo', [usernames.join(os.EOL)]);
    return Prompts.shouldRunCommand(this.ux, this.flags.noprompt, message);
  }
}
