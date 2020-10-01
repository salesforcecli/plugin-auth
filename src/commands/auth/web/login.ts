/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as open from 'open';

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthFields, AuthInfo, Messages, OAuth2Options, SfdxError, WebOAuthServer } from '@salesforce/core';
import { Env } from '@salesforce/kit';
import { Prompts } from '../../../prompts';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'web.login');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export default class Login extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static readonly flagsConfig: FlagsConfig = {
    clientid: flags.string({
      char: 'i',
      description: commonMessages.getMessage('clientId'),
    }),
    instanceurl: flags.url({
      char: 'r',
      description: commonMessages.getMessage('instanceUrl'),
    }),
    setdefaultdevhubusername: flags.boolean({
      char: 'd',
      description: commonMessages.getMessage('setDefaultDevHub'),
    }),
    setdefaultusername: flags.boolean({
      char: 's',
      description: commonMessages.getMessage('setDefaultUsername'),
    }),
    setalias: flags.string({
      char: 'a',
      description: commonMessages.getMessage('setAlias'),
    }),
    disablemasking: flags.boolean({
      description: messages.getMessage('disableMasking'),
      hidden: true,
    }),
    noprompt: flags.boolean({
      char: 'p',
      description: commonMessages.getMessage('noPromptAuth'),
      required: false,
      hidden: true,
    }),
  };

  public async run(): Promise<AuthFields> {
    if (this.isSFDXContainerMode()) {
      throw new SfdxError(messages.getMessage('deviceWarning'), 'DEVICE_WARNING');
    }

    if (await Prompts.shouldExitCommand(this.ux, this.flags.noprompt)) return {};

    const oauthConfig: OAuth2Options = {
      loginUrl: this.flags.instanceurl,
      clientId: this.flags.clientid,
    };

    if (this.flags.clientid) {
      const secret = await this.ux.prompt(messages.getMessage('clientSecretStdin'), {
        type: this.flags.disablemasking ? 'normal' : 'hide',
      });
      oauthConfig.clientSecret = secret;
    }

    try {
      const authInfo = await this.executeLoginFlow(oauthConfig);

      if (this.flags.setalias) {
        await authInfo.setAlias(this.flags.setalias);
      }

      if (this.flags.setdefaultdevhubusername || this.flags.setdefaultusername) {
        await authInfo.setAsDefault({
          defaultUsername: this.flags.setdefaultusername,
          defaultDevhubUsername: this.flags.setdefaultdevhubusername,
        });
      }
      const fields = authInfo.getFields();
      const successMsg = commonMessages.getMessage('authorizeCommandSuccess', [fields.username, fields.orgId]);
      this.ux.log(successMsg);
      return fields;
    } catch (err) {
      if (err.name === 'AuthCodeExchangeError') {
        this.ux.error(messages.getMessage('invalidClientId'));
      } else {
        this.ux.error(err.message);
      }
      return {};
    }
  }

  private async executeLoginFlow(oauthConfig: OAuth2Options): Promise<AuthInfo> {
    const oauthServer = await WebOAuthServer.create({ oauthConfig });
    await oauthServer.start();
    await open(oauthServer.getAuthorizationUrl(), { wait: false });
    return oauthServer.loginAndSave();
  }

  private isSFDXContainerMode(): boolean {
    const env = new Env();
    return env.getBoolean('SFDX_CONTAINER_MODE');
  }
}
