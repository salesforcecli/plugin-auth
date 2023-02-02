/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags } from '@salesforce/sf-plugins-core';
import { AuthFields, AuthInfo, Messages, sfdc, SfError, StateAggregator } from '@salesforce/core';
import { ensureString, getString } from '@salesforce/ts-types';
import { env } from '@salesforce/kit';
import { Interfaces } from '@oclif/core';
import { AuthBaseCommand } from '../../../authBaseCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'accesstoken.store');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

const ACCESS_TOKEN_FORMAT = '"<org id>!<accesstoken>"';

export default class Store extends AuthBaseCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly deprecateAliases = true;
  public static aliases = ['force:auth:accesstoken:store'];

  public static readonly flags = {
    'instance-url': Flags.url({
      char: 'r',
      summary: commonMessages.getMessage('instanceUrl'),
      required: true,
      deprecateAliases: true,
      aliases: ['instanceurl'],
    }),
    'set-default-dev-hub': Flags.boolean({
      char: 'd',
      summary: commonMessages.getMessage('setDefaultDevHub'),
      default: false,
      deprecateAliases: true,
      aliases: ['setdefaultdevhub'],
    }),
    'set-default': Flags.boolean({
      char: 's',
      summary: commonMessages.getMessage('setDefaultUsername'),
      default: false,
      deprecateAliases: true,
      aliases: ['setdefaultusername'],
    }),
    alias: Flags.string({
      char: 'a',
      summary: commonMessages.getMessage('setAlias'),
      deprecateAliases: true,
      aliases: ['setalias'],
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: commonMessages.getMessage('noPrompt'),
      required: false,
      default: false,
      deprecateAliases: true,
      aliases: ['noprompt'],
    }),
  };

  private flags: Interfaces.InferredFlags<typeof Store.flags>;

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(Store);
    this.flags = flags;
    this.flags = flags;
    const instanceUrl = ensureString(getString(flags, 'instance-url.href'));
    const accessToken = await this.getAccessToken();
    const authInfo = await this.getUserInfo(accessToken, instanceUrl);
    return this.storeAuthFromAccessToken(authInfo);
  }

  // because stubbed on the test (instead of stubbing in core)
  // eslint-disable-next-line class-methods-use-this
  private async getUserInfo(accessToken: string, instanceUrl: string): Promise<AuthInfo> {
    return AuthInfo.create({ accessTokenOptions: { accessToken, instanceUrl, loginUrl: instanceUrl } });
  }

  private async storeAuthFromAccessToken(authInfo: AuthInfo): Promise<AuthFields> {
    if (await this.overwriteAuthInfo(authInfo.getUsername())) {
      await this.saveAuthInfo(authInfo);
      const successMsg = commonMessages.getMessage('authorizeCommandSuccess', [
        authInfo.getUsername(),
        authInfo.getFields(true).orgId,
      ]);
      this.log(successMsg);
    }
    return authInfo.getFields(true);
  }

  private async saveAuthInfo(authInfo: AuthInfo): Promise<void> {
    await authInfo.save();
    await authInfo.handleAliasAndDefaultSettings({
      alias: this.flags.alias,
      setDefault: this.flags['set-default'],
      setDefaultDevHub: this.flags['set-default-dev-hub'],
    });
    await AuthInfo.identifyPossibleScratchOrgs(authInfo.getFields(true), authInfo);
  }

  private async overwriteAuthInfo(username: string): Promise<boolean> {
    if (!this.flags['no-prompt']) {
      const stateAggregator = await StateAggregator.getInstance();
      if (await stateAggregator.orgs.exists(username)) {
        return this.askOverwriteAuthFile(username);
      }
    }
    return true;
  }

  private async getAccessToken(): Promise<string> {
    const accessToken = env.getString('SFDX_ACCESS_TOKEN') ?? (await this.askForAccessToken());

    if (!sfdc.matchesAccessToken(accessToken)) {
      throw new SfError(messages.getMessage('invalidAccessTokenFormat', [ACCESS_TOKEN_FORMAT]));
    }
    return accessToken;
  }
}
