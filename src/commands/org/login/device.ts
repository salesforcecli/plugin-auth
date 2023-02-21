/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OAuth2Config } from 'jsforce';
import { AuthFields, AuthInfo, DeviceOauthService, Messages } from '@salesforce/core';
import { get, Optional } from '@salesforce/ts-types';
import { Flags, loglevel } from '@salesforce/sf-plugins-core';
import { DeviceCodeResponse } from '@salesforce/core/lib/deviceOauthService';
import { ux } from '@oclif/core';
import { AuthBaseCommand } from '../../../authBaseCommand';
import { Common } from '../../../common';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'device.login');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export type DeviceLoginResult = (AuthFields & DeviceCodeResponse) | Record<string, never>;

export default class LoginDevice extends AuthBaseCommand<DeviceLoginResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static aliases = ['force:auth:device:login', 'auth:device:login'];

  public static readonly flags = {
    'client-id': Flags.string({
      char: 'i',
      summary: commonMessages.getMessage('flags.client-id.summary'),
      deprecateAliases: true,
      aliases: ['clientid'],
    }),
    'instance-url': Flags.url({
      char: 'r',
      summary: commonMessages.getMessage('flags.instance-url.summary'),
      description: commonMessages.getMessage('flags.instance-url.description'),
      deprecateAliases: true,
      aliases: ['instanceurl'],
    }),
    'set-default-dev-hub': Flags.boolean({
      char: 'd',
      summary: commonMessages.getMessage('flags.set-default-dev-hub.summary'),
      deprecateAliases: true,
      aliases: ['setdefaultdevhub', 'setdefaultdevhubusername'],
    }),
    'set-default': Flags.boolean({
      char: 's',
      summary: commonMessages.getMessage('flags.set-default.summary'),
      deprecateAliases: true,
      aliases: ['setdefaultusername'],
    }),
    alias: Flags.string({
      char: 'a',
      summary: commonMessages.getMessage('flags.alias.summary'),
      deprecateAliases: true,
      aliases: ['setalias'],
    }),
    'disable-masking': Flags.boolean({
      summary: commonMessages.getMessage('flags.disable-masking.summary'),
      hidden: true,
      deprecateAliases: true,
      aliases: ['disablemasking'],
    }),
    loglevel,
  };

  public async run(): Promise<DeviceLoginResult> {
    const { flags } = await this.parse(LoginDevice);
    if (await this.shouldExitCommand(false)) return {};

    const oauthConfig: OAuth2Config = {
      loginUrl: await Common.resolveLoginUrl(get(flags['instance-url'], 'href', null) as Optional<string>),
      clientId: flags['client-id'] as string,
    };

    if (flags['client-id']) {
      oauthConfig.clientSecret = await this.askForClientSecret(flags['disable-masking']);
    }

    const deviceOauthService = await DeviceOauthService.create(oauthConfig);
    const loginData = await deviceOauthService.requestDeviceLogin();

    if (this.jsonEnabled()) {
      ux.log(JSON.stringify(loginData, null, 2));
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
      this.logSuccess(successMsg);
      return { ...fields, ...loginData };
    } else {
      return {};
    }
  }
}
