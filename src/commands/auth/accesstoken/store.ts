/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthFields, AuthInfo, Messages, sfdc, SfError, StateAggregator } from '@salesforce/core';
import { ensureString, getString } from '@salesforce/ts-types';
import { env } from '@salesforce/kit';
import { Prompts } from '../../../prompts';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'accesstoken.store');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

const ACCESS_TOKEN_FORMAT = '"<org id>!<accesstoken>"';

export default class Store extends SfdxCommand {
  public static readonly description = messages.getMessage('description', [ACCESS_TOKEN_FORMAT]);
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static aliases = ['force:auth:accesstoken:store'];

  public static readonly flagsConfig: FlagsConfig = {
    instanceurl: flags.url({
      char: 'r',
      description: commonMessages.getMessage('instanceUrl'),
      required: true,
    }),
    setdefaultdevhubusername: flags.boolean({
      char: 'd',
      description: commonMessages.getMessage('setDefaultDevHub'),
      default: false,
    }),
    setdefaultusername: flags.boolean({
      char: 's',
      description: commonMessages.getMessage('setDefaultUsername'),
      default: false,
    }),
    setalias: flags.string({
      char: 'a',
      description: commonMessages.getMessage('setAlias'),
    }),
    noprompt: flags.boolean({
      char: 'p',
      description: commonMessages.getMessage('noPrompt'),
      required: false,
      default: false,
    }),
  };

  public async run(): Promise<AuthFields> {
    const instanceUrl = ensureString(getString(this.flags, 'instanceurl.href'));
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
      this.ux.log(successMsg);
    }
    return authInfo.getFields(true);
  }

  private async saveAuthInfo(authInfo: AuthInfo): Promise<void> {
    await authInfo.save();
    await authInfo.handleAliasAndDefaultSettings({
      alias: this.flags.setalias as string,
      setDefault: this.flags.setdefaultusername as boolean,
      setDefaultDevHub: this.flags.setdefaultdevhubusername as boolean,
    });
    await AuthInfo.identifyPossibleScratchOrgs(authInfo.getFields(true), authInfo);
  }

  private async overwriteAuthInfo(username: string): Promise<boolean> {
    if (!this.flags.noprompt) {
      const stateAggregator = await StateAggregator.getInstance();
      if (await stateAggregator.orgs.exists(username)) {
        return Prompts.askOverwriteAuthFile(this.ux, username);
      }
    }
    return true;
  }

  private async getAccessToken(): Promise<string> {
    let accessToken: string;
    if (env.getString('SFDX_ACCESS_TOKEN')) {
      accessToken = env.getString('SFDX_ACCESS_TOKEN');
    } else {
      accessToken = await Prompts.askForAccessToken(this.ux);
    }
    if (!sfdc.matchesAccessToken(accessToken)) {
      throw new SfError(messages.getMessage('invalidAccessTokenFormat', [ACCESS_TOKEN_FORMAT]));
    }
    return accessToken;
  }
}
