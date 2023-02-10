/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { AuthRemover, ConfigAggregator, Global, Messages, Mode, OrgConfigProperties, SfError } from '@salesforce/core';
import { Flags, loglevel } from '@salesforce/sf-plugins-core';
import { Interfaces } from '@oclif/core';
import { isString } from '@salesforce/ts-types';
import { AuthBaseCommand } from '../../authBaseCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'logout');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export type AuthLogoutResults = string[];

export default class Logout extends AuthBaseCommand<AuthLogoutResults> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly deprecateAliases = true;
  public static aliases = ['force:auth:logout', 'auth:logout'];

  public static readonly flags = {
    // taking control over target-org vs using a org flag from sf-plugins-core to guarantee
    // idempotency of the command
    'target-org': Flags.string({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
      aliases: ['targetusername', 'u'],
      deprecateAliases: true,
    }),
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
    loglevel,
  };

  private flags: Interfaces.InferredFlags<typeof Logout.flags>;

  public async run(): Promise<AuthLogoutResults> {
    const { flags } = await this.parse(Logout);
    this.flags = flags;
    this.configAggregator = await ConfigAggregator.create();
    const remover = await AuthRemover.create();

    let usernames: AuthLogoutResults;
    try {
      const targetUsername =
        this.flags['target-org'] ?? (this.configAggregator.getInfo(OrgConfigProperties.TARGET_ORG).value as string);
      usernames = (
        this.shouldFindAllAuths()
          ? Object.keys(remover.findAllAuths())
          : [(await remover.findAuth(targetUsername))?.username ?? targetUsername]
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
      this.logSuccess(messages.getMessage('logoutOrgCommandSuccess', [usernames.join(os.EOL)]));
      return usernames;
    } else {
      return [];
    }
  }

  private shouldFindAllAuths(): boolean {
    return !!this.flags.all || (!this.flags['target-org'] && Global.getEnvironmentMode() === Mode.DEMO);
  }

  private async shouldRunLogoutCommand(usernames: Array<string | undefined>): Promise<boolean> {
    const orgsToDelete = usernames.filter(isString);
    if (orgsToDelete.length === 0) {
      this.log(messages.getMessage('logoutOrgCommandNoOrgsFound'));
      return false;
    }
    const message = messages.getMessage('logoutCommandYesNo', [
      orgsToDelete.join(os.EOL),
      this.config.bin,
      this.config.bin,
      this.config.bin,
    ]);
    return this.shouldRunCommand(this.flags['no-prompt'], message, false);
  }
}
