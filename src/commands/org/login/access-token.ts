/*
 * Copyright 2026, Salesforce, Inc.
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

import { Flags, loglevel, SfCommand } from '@salesforce/sf-plugins-core';
import { AuthFields, AuthInfo, Messages, matchesAccessToken, SfError, StateAggregator } from '@salesforce/core';
import { env } from '@salesforce/kit';
import { InferredFlags } from '@oclif/core/interfaces';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'accesstoken.store');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

const ACCESS_TOKEN_FORMAT = '"<org id>!<accesstoken>"';

export default class LoginAccessToken extends SfCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly deprecateAliases = true;
  public static readonly aliases = ['force:auth:accesstoken:store', 'auth:accesstoken:store'];

  public static readonly flags = {
    'instance-url': Flags.url({
      char: 'r',
      summary: commonMessages.getMessage('flags.instance-url.summary'),
      description: commonMessages.getMessage('flags.instance-url.description'),
      required: true,
      deprecateAliases: true,
      aliases: ['instanceurl'],
    }),
    'set-default-dev-hub': Flags.boolean({
      char: 'd',
      summary: commonMessages.getMessage('flags.set-default-dev-hub.summary'),
      default: false,
      deprecateAliases: true,
      aliases: ['setdefaultdevhub', 'setdefaultdevhubusername'],
    }),
    'set-default': Flags.boolean({
      char: 's',
      summary: commonMessages.getMessage('flags.set-default.summary'),
      default: false,
      deprecateAliases: true,
      aliases: ['setdefaultusername'],
    }),
    alias: Flags.string({
      char: 'a',
      summary: commonMessages.getMessage('flags.alias.summary'),
      deprecateAliases: true,
      aliases: ['setalias'],
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: commonMessages.getMessage('flags.no-prompt.summary'),
      required: false,
      default: false,
      deprecateAliases: true,
      aliases: ['noprompt'],
    }),
    loglevel,
  };

  private flags!: InferredFlags<typeof LoginAccessToken.flags>;

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(LoginAccessToken);
    this.flags = flags;
    const instanceUrl = flags['instance-url'].href;
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
      this.logSuccess(successMsg);
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
        return this.confirm({ message: messages.getMessage('overwriteAccessTokenAuthUserFile', [username]) });
      }
    }
    return true;
  }

  private async getAccessToken(): Promise<string> {
    const accessToken =
      env.getString('SF_ACCESS_TOKEN') ??
      env.getString('SFDX_ACCESS_TOKEN') ??
      (this.flags['no-prompt'] === true
        ? '' // will throw when validating
        : await this.secretPrompt({ message: commonMessages.getMessage('accessTokenStdin') }));
    if (!matchesAccessToken(accessToken)) {
      throw new SfError(messages.getMessage('invalidAccessTokenFormat', [ACCESS_TOKEN_FORMAT]));
    }
    return accessToken;
  }
}
