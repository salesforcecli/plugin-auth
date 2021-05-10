/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthFields, AuthInfo, Connection, Messages } from '@salesforce/core';
import { AnyJson, getBoolean, ensureString, getString } from '@salesforce/ts-types';
import { Prompts } from '../../../prompts';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'token.set');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

const ACCESS_TOEKN_FORMAT1 = '"<org id>!<token>"';

/* eslint-disable camelcase */
type UserInfo = AnyJson & {
  preferred_username: string;
  organization_id: string;
  custom_domain: string;
};
/* eslint-enable camelcase */

export default class Set extends SfdxCommand {
  public static readonly description = messages.getMessage('description', [ACCESS_TOEKN_FORMAT1]);
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static aliases = ['force:auth:token:set'];

  public static readonly flagsConfig: FlagsConfig = {
    instanceurl: flags.url({
      char: 'r',
      description: commonMessages.getMessage('instanceUrl'),
      required: true,
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
  };

  public async run(): Promise<AuthFields> {
    const instanceUrl = ensureString(getString(this.flags, 'instanceurl.href'));

    // prompt for access token
    const accessToken = await Prompts.askForAccessToken(this.ux);

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
    const userInfo = (await connection.request('/services/oauth2/userinfo')) as UserInfo;

    // create AuthInfo with additional information
    const authInfoToSave = await AuthInfo.create({
      username: userInfo.preferred_username,
      accessTokenOptions: { accessToken, instanceUrl },
    });

    // apply additional user supplied parameters to the new AuthInfo
    await authInfoToSave.setAsDefault({
      defaultUsername: getBoolean(this.flags, 'setdefaultusername', false),
    });
    if (this.flags.alias) {
      await authInfoToSave.setAlias(this.flags.alias);
    }
    authInfoToSave.update({
      orgId: userInfo.organization_id,
      loginUrl: getString(this, 'flags.instanceurl'),
    });
    // save the AuthInfo
    await authInfoToSave.save();
    return authInfoToSave.getFields(true);
  }
}
