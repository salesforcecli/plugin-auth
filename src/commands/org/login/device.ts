/*
 * Copyright 2025, Salesforce, Inc.
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

import {
  type AuthFields,
  AuthInfo,
  DeviceOauthService,
  Messages,
  type OAuth2Config,
  type DeviceCodeResponse,
} from '@salesforce/core';
import { Flags, SfCommand, loglevel, Ux } from '@salesforce/sf-plugins-core';
import common from '../../../common.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'device.login');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export type DeviceLoginResult = (AuthFields & DeviceCodeResponse) | Record<string, never>;

export default class LoginDevice extends SfCommand<DeviceLoginResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:auth:device:login', 'auth:device:login'];
  public static readonly deprecateAliases = true;
  public static readonly hidden = true;
  public static readonly deprecated = true;

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
    loglevel,
  };

  public async run(): Promise<DeviceLoginResult> {
    const { flags } = await this.parse(LoginDevice);
    if (await common.shouldExitCommand(false)) return {};

    const oauthConfig: OAuth2Config = {
      loginUrl: await common.resolveLoginUrl(flags['instance-url']?.href),
      clientId: flags['client-id'],
    };

    const deviceOauthService = await DeviceOauthService.create(oauthConfig);
    const loginData = await deviceOauthService.requestDeviceLogin();

    if (this.jsonEnabled()) {
      new Ux().log(JSON.stringify(loginData, null, 2));
    } else {
      this.log();
      this.warn('Device Oauth flow is deprecated and will be removed mid January 2026\n');
      this.styledHeader(messages.getMessage('actionRequired'));
      this.log(messages.getMessage('enterCode', [loginData.user_code, loginData.verification_uri]));
      this.log();
    }

    const approval = await deviceOauthService.awaitDeviceApproval(loginData);
    if (approval) {
      const authInfo = await deviceOauthService.authorizeAndSave(approval);
      await authInfo.handleAliasAndDefaultSettings({
        alias: flags.alias,
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
