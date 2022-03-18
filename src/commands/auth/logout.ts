/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';
import { AuthRemover, ConfigAggregator, Global, Messages, Mode, OrgConfigProperties, SfError } from '@salesforce/core';
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
    let usernames: string[];
    let usingSfdxFolder = false;

    const ca = ConfigAggregator.getInstance();

    const targetUsername = this.flags.targetusername
      ? (this.flags.targetusername as string)
      : (ca.getInfo(OrgConfigProperties.TARGET_ORG).value as string);

    try {
      usernames = this.shouldFindAllAuths()
        ? Object.keys(remover.findAllAuths())
        : [(await remover.findAuth(targetUsername)).username];
    } catch (e) {
      if ((e as SfError).name === 'NamedOrgNotFound') {
        // try looking in the old ~/.sfdx folder
        // TODO: Can be removed once everything is in the `~/.sf` folder
        if (fs.existsSync(join('~', '.sfdx', `${targetUsername}.json`))) {
          usingSfdxFolder = true;
          usernames = [targetUsername];
        }
      } else {
        // can't type e as Error. catch(e) requires e as unknown or any
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        e.name = 'NoOrgFound';
        throw e;
      }
    }

    if (await this.shouldRunCommand(usernames)) {
      for (const username of usernames) {
        if (usingSfdxFolder) {
          await fs.promises.rm(join('~', '.sfdx', `${targetUsername}.json`));
        } else {
          await remover.removeAuth(username);
        }
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
    const orgsToDelete = [[...usernames].join(os.EOL)];
    const message = messages.getMessage('logoutCommandYesNo', orgsToDelete);
    return Prompts.shouldRunCommand(this.ux, this.flags.noprompt, message);
  }
}
