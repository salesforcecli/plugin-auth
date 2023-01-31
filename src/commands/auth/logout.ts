/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { AuthRemover, Global, Messages, Mode, OrgConfigProperties, SfError } from '@salesforce/core';
import { Flags, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import { Interfaces } from '@oclif/core';
import { AuthBaseCommand } from '../../prompts';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'logout');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export type AuthLogoutResults = string[];

export default class Logout extends AuthBaseCommand<AuthLogoutResults> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly deprecateAliases = true;
  public static aliases = ['force:auth:logout'];

  public static readonly flags = {
    'target-org': optionalOrgFlagWithDeprecations,
    all: Flags.boolean({
      char: 'a',
      summary: messages.getMessage('all'),
      description: messages.getMessage('allLong'),
      required: false,
      exclusive: ['target-org'],
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: commonMessages.getMessage('noPrompt'),
      required: false,
      deprecateAliases: true,
      aliases: ['noprompt'],
    }),
  };

  private flags: Interfaces.InferredFlags<typeof Logout.flags>;

  public async run(): Promise<AuthLogoutResults> {
    const { flags } = await this.parse(Logout);
    this.flags = flags;

    const remover = await AuthRemover.create();

    const targetUsername = flags.targetusername
      ? (flags.targetusername as string)
      : (this.configAggregator.getInfo(OrgConfigProperties.TARGET_ORG).value as string);
    let usernames: AuthLogoutResults;
    try {
      usernames = (
        this.shouldFindAllAuths()
          ? Object.keys(remover.findAllAuths())
          : [(await remover.findAuth(targetUsername)).username]
      ).filter((username) => username) as AuthLogoutResults;
    } catch (e) {
      // keep the error name the same for SFDX
      const err = e as Error;
      err.name = 'NoOrgFound';
      throw SfError.wrap(err);
    }

    if (await this.shouldRunLogoutCommand(usernames)) {
      for (const username of usernames) {
        // run sequentially to avoid configFile concurrency issues
        // eslint-disable-next-line no-await-in-loop
        await remover.removeAuth(username);
      }
      this.log(messages.getMessage('logoutOrgCommandSuccess', [usernames.join(os.EOL)]));
      return usernames;
    } else {
      return [];
    }
  }

  private shouldFindAllAuths(): boolean {
    return !!this.flags.all || (!this.flags['target-org'] && Global.getEnvironmentMode() === Mode.DEMO);
  }

  private async shouldRunLogoutCommand(usernames: Array<string | undefined>): Promise<boolean> {
    const orgsToDelete = [usernames.filter((username) => username).join(os.EOL)];
    if (orgsToDelete.length === 0) {
      this.log(messages.getMessage('logoutOrgCommandNoOrgsFound'));
      return false;
    }
    const message = messages.getMessage('logoutCommandYesNo', orgsToDelete);
    return this.shouldRunCommand(this.flags['no-prompt'], message);
  }
}
