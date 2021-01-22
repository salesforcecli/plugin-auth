/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthFields, DeviceOauthService, Messages, OAuth2Options } from '@salesforce/core';
import { get, Optional } from '@salesforce/ts-types';
import { Prompts } from '../../../prompts';
import { Common } from '../../../common';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'device.login');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export default class Login extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static aliases = ['force:auth:device:login'];

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
      description: commonMessages.getMessage('disableMasking'),
      hidden: true,
    }),
  };

  public async run(): Promise<AuthFields> {
    if (await Prompts.shouldExitCommand(this.ux, this.flags.noprompt)) return {};

    const oauthConfig: OAuth2Options = {
      loginUrl: get(this.flags.instanceurl, 'href', null) as Optional<string>,
      clientId: this.flags.clientid,
    };

    if (this.flags.clientid) {
      oauthConfig.clientSecret = await Prompts.askForClientSecret(this.ux, this.flags.disablemasking);
    }

    const deviceOauthService = await DeviceOauthService.create(oauthConfig);
    const loginData = await deviceOauthService.requestDeviceLogin();

    if (this.flags.json) {
      this.ux.logJson(loginData);
    } else {
      this.ux.styledHeader(messages.getMessage('actionRequired'));
      this.ux.log(messages.getMessage('enterCode'), loginData.user_code, loginData.verification_uri);
      this.ux.log();
    }

    const approval = await deviceOauthService.awaitDeviceApproval(loginData);
    if (approval) {
      const authInfo = await deviceOauthService.authorizeAndSave(approval);
      await Common.handleSideEffects(authInfo, this.flags);
      const fields = authInfo.getFields(true);
      const successMsg = messages.getMessage('success', [fields.username]);
      this.ux.log(successMsg);
      return fields;
    } else {
      return {};
    }
  }
}
