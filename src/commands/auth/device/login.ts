/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OAuth2Config } from 'jsforce';
import { AuthFields, AuthInfo, DeviceOauthService, Messages } from '@salesforce/core';
import { get, Optional } from '@salesforce/ts-types';
import { Flags } from '@salesforce/sf-plugins-core';
import { AuthBaseCommand } from '../../../authBaseCommand';
import { Common } from '../../../common';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'device.login');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export default class Login extends AuthBaseCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static aliases = ['force:auth:device:login'];

  public static readonly flags = {
    'client-id': Flags.string({
      char: 'i',
      summary: commonMessages.getMessage('clientId'),
      deprecateAliases: true,
      aliases: ['clientid'],
    }),
    'instance-url': Flags.url({
      char: 'r',
      summary: commonMessages.getMessage('instanceUrl'),
      deprecateAliases: true,
      aliases: ['instanceurl'],
    }),
    'set-default-dev-hub': Flags.boolean({
      char: 'd',
      summary: commonMessages.getMessage('setDefaultDevHub'),
      deprecateAliases: true,
      aliases: ['setdefaultdevhub'],
    }),
    'set-default': Flags.boolean({
      char: 's',
      summary: commonMessages.getMessage('setDefaultUsername'),
      deprecateAliases: true,
      aliases: ['setdefaultusername'],
    }),
    alias: Flags.string({
      char: 'a',
      summary: commonMessages.getMessage('setAlias'),
      deprecateAliases: true,
      aliases: ['setalias'],
    }),
    'disable-masking': Flags.boolean({
      summary: commonMessages.getMessage('disableMasking'),
      hidden: true,
      deprecateAliases: true,
      aliases: ['disablemasking'],
    }),
  };

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(Login);
    if (await this.shouldExitCommand(false)) return {};

    const oauthConfig: OAuth2Config = {
      loginUrl: await Common.resolveLoginUrl(get(flags.instanceurl, 'href', null) as Optional<string>),
      clientId: flags.clientid as string,
    };

    if (flags.clientid) {
      oauthConfig.clientSecret = await this.askForClientSecret(flags['disable-masking']);
    }

    const deviceOauthService = await DeviceOauthService.create(oauthConfig);
    const loginData = await deviceOauthService.requestDeviceLogin();

    if (flags.json) {
      this.styledJSON(loginData);
    } else {
      this.styledHeader(messages.getMessage('actionRequired'));
      this.log(messages.getMessage('enterCode', [loginData.user_code, loginData.verification_uri]));
      this.log();
    }

    const approval = await deviceOauthService.awaitDeviceApproval(loginData);
    if (approval) {
      const authInfo = await deviceOauthService.authorizeAndSave(approval);
      await authInfo.handleAliasAndDefaultSettings({
        alias: flags.alias as string,
        setDefault: flags['set-default'],
        setDefaultDevHub: flags['set-default-dev-hub'],
      });
      const fields = authInfo.getFields(true);
      await AuthInfo.identifyPossibleScratchOrgs(fields, authInfo);
      const successMsg = messages.getMessage('success', [fields.username]);
      this.log(successMsg);
      return fields;
    } else {
      return {};
    }
  }
}
