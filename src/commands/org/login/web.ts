/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as open from 'open';

import { Flags, loglevel } from '@salesforce/sf-plugins-core';
import { OAuth2Config } from 'jsforce';
import { AuthFields, AuthInfo, Logger, Messages, SfError, WebOAuthServer } from '@salesforce/core';
import { Env } from '@salesforce/kit';
import { get, Optional } from '@salesforce/ts-types';
import { Interfaces } from '@oclif/core';
import { AuthBaseCommand } from '../../../authBaseCommand';
import { Common } from '../../../common';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'web.login');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export default class LoginWeb extends AuthBaseCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly deprecateAliases = true;
  public static aliases = ['force:auth:web:login', 'auth:web:login'];

  public static readonly flags = {
    browser: Flags.string({
      char: 'b',
      summary: messages.getMessage('flags.browser.summary'),
      description: messages.getMessage('flags.browser.description'),
      options: ['chrome', 'edge', 'firefox'], // These are ones supported by "open" package
    }),
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
      aliases: ['setdefaultdevhubusername'],
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
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: commonMessages.getMessage('flags.no-prompt.summary'),
      required: false,
      hidden: true,
      deprecateAliases: true,
      aliases: ['noprompt'],
    }),
    loglevel,
  };

  private flags: Interfaces.InferredFlags<typeof LoginWeb.flags>;

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(LoginWeb);
    this.flags = flags;
    if (isSFDXContainerMode()) {
      throw new SfError(messages.getMessage('deviceWarning'), 'DEVICE_WARNING');
    }

    if (await this.shouldExitCommand(flags['no-prompt'])) return {};

    const oauthConfig: OAuth2Config = {
      loginUrl: await Common.resolveLoginUrl(get(flags['instance-url'], 'href', null) as Optional<string>),
      clientId: flags.clientid as string,
    };

    if (flags.clientid) {
      oauthConfig.clientSecret = await this.askForClientSecret(flags['disable-masking']);
    }

    try {
      const authInfo = await this.executeLoginFlow(oauthConfig);
      await authInfo.handleAliasAndDefaultSettings({
        alias: flags.alias,
        setDefault: flags['set-default'],
        setDefaultDevHub: flags['set-default-dev-hub'],
      });
      const fields = authInfo.getFields(true);
      await AuthInfo.identifyPossibleScratchOrgs(fields, authInfo);

      const successMsg = commonMessages.getMessage('authorizeCommandSuccess', [fields.username, fields.orgId]);
      this.logSuccess(successMsg);
      return fields;
    } catch (err) {
      const error = err as Error;
      Logger.childFromRoot('auth').debug(error);
      if (error.name === 'AuthCodeExchangeError') {
        throw new SfError(messages.getMessage('invalidClientId', [error.message]));
      }
      throw error;
    }
  }

  // leave it because it's stubbed in the test
  // eslint-disable-next-line class-methods-use-this
  private async executeLoginFlow(oauthConfig: OAuth2Config): Promise<AuthInfo> {
    const oauthServer = await WebOAuthServer.create({ oauthConfig });
    await oauthServer.start();
    const openOptions = this.flags.browser
      ? { app: { name: open.apps[this.flags.browser] as open.AppName }, wait: false }
      : { wait: false };
    await open(oauthServer.getAuthorizationUrl(), openOptions);
    return oauthServer.authorizeAndSave();
  }
}

const isSFDXContainerMode = (): boolean => {
  const env = new Env();
  return env.getBoolean('SFDX_CONTAINER_MODE');
};
