/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthFields, AuthInfo, AuthInfoConfig, Connection, fs, Messages, sfdc, SfdxError } from '@salesforce/core';
import { AnyJson, ensureString, getString } from '@salesforce/ts-types';
import { Prompts } from '../../../prompts';
import { Common } from '../../../common';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'accesstoken.store');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

const ACCESS_TOKEN_FORMAT1 = '"<org id>!<accesstoken>"';

/* eslint-disable camelcase */
type UserInfo = AnyJson & {
  preferred_username: string;
  organization_id: string;
  custom_domain: string;
};
/* eslint-enable camelcase */

export default class Store extends SfdxCommand {
  public static readonly description = messages.getMessage('description', [ACCESS_TOKEN_FORMAT1]);
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static aliases = ['force:auth:accesstoken:store'];

  public static readonly flagsConfig: FlagsConfig = {
    instanceurl: flags.url({
      char: 'r',
      description: commonMessages.getMessage('instanceUrl'),
      required: true,
    }),
    accesstokenfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('accessTokenFile'),
      required: false,
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

  private static async getUserInfo(accessToken: string, instanceUrl: string): Promise<UserInfo> {
    // use access token in a request to userinfo to capture the user data
    const authInfo = await AuthInfo.create({
      username: accessToken,
      accessTokenOptions: { loginUrl: instanceUrl, instanceUrl },
    });
    authInfo.update({
      loginUrl: instanceUrl,
    });
    const connection = await Connection.create({ connectionOptions: { loginUrl: instanceUrl }, authInfo });
    await connection.useLatestApiVersion();
    return (await connection.request('/services/oauth2/userinfo')) as UserInfo;
  }

  public async run(): Promise<AuthFields> {
    const instanceUrl = ensureString(getString(this.flags, 'instanceurl.href'));
    const accessToken = await this.getAccessToken();
    const userInfo = await Store.getUserInfo(accessToken, instanceUrl);
    return await this.storeAuthFromAccessToken(userInfo, accessToken, instanceUrl);
  }

  private async storeAuthFromAccessToken(
    userInfo: UserInfo,
    accessToken: string,
    instanceUrl: string
  ): Promise<AuthFields> {
    if (await this.overwriteAuthInfo(userInfo.preferred_username)) {
      // create AuthInfo with additional information
      const authInfoToSave = await AuthInfo.create({
        username: userInfo.preferred_username,
        accessTokenOptions: { accessToken, instanceUrl, loginUrl: instanceUrl },
      });

      authInfoToSave.update({
        orgId: userInfo.organization_id,
      });

      await authInfoToSave.save();
      await Common.handleSideEffects(authInfoToSave, this.flags);

      const successMsg = commonMessages.getMessage('authorizeCommandSuccess', [
        authInfoToSave.getUsername(),
        authInfoToSave.getFields(true).orgId,
      ]);
      this.ux.log(successMsg);

      return authInfoToSave.getFields(true);
    } else {
      const existingAuthIno = await AuthInfo.create({ username: userInfo.preferred_username });
      return existingAuthIno.getFields(true);
    }
  }

  private async overwriteAuthInfo(username: string): Promise<boolean> {
    if (!this.flags.noprompt) {
      const authInfoConfig = await AuthInfoConfig.create({
        ...AuthInfoConfig.getOptions(username),
        throwOnNotFound: false,
      });
      if (await authInfoConfig.exists()) {
        const yN = await this.ux.prompt(messages.getMessage('overwriteAuthFileYesNo', [username]), {
          type: 'normal',
          default: 'y',
        });
        return yN.toLowerCase().startsWith('y');
      }
    }
    return true;
  }

  private async getAccessToken(): Promise<string> {
    let accessToken: string;
    if (this.flags.accesstokenfile) {
      if (!fs.existsSync(this.flags.accesstokenfile)) {
        throw new SfdxError(messages.getMessage('filesDoesNotExist', [this.flags.accesstokenfile]));
      }
      accessToken = (await fs.readFile(this.flags.accesstokenfile, 'utf8')).trim();
    } else {
      accessToken = await Prompts.askForAccessToken(this.ux);
    }
    if (!sfdc.matchesAccessToken(accessToken)) {
      throw new SfdxError(messages.getMessage('invalidAccessTokenFormat', [ACCESS_TOKEN_FORMAT1]));
    }
    return accessToken;
  }
}
