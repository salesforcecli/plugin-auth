/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import open, { apps, AppName } from 'open';
import { Flags, SfCommand, loglevel } from '@salesforce/sf-plugins-core';
import { AuthFields, AuthInfo, Logger, Messages, OAuth2Config, SfError, WebOAuthServer } from '@salesforce/core';
import { Env } from '@salesforce/kit';
import common from '../../../common.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'web.login');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export default class LoginWeb extends SfCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly deprecateAliases = true;
  public static readonly aliases = ['force:auth:web:login', 'auth:web:login'];

  public static readonly flags = {
    browser: Flags.option({
      char: 'b',
      summary: messages.getMessage('flags.browser.summary'),
      description: messages.getMessage('flags.browser.description'),
      options: ['chrome', 'edge', 'firefox'], // These are ones supported by "open" package
    })(),
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
      aliases: ['instanceurl', 'l'],
    }),
    'set-default-dev-hub': Flags.boolean({
      char: 'd',
      summary: commonMessages.getMessage('flags.set-default-dev-hub.summary'),
      deprecateAliases: true,
      aliases: ['setdefaultdevhubusername', 'setdefaultdevhub', 'v'],
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

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(LoginWeb);
    if (isSFDXContainerMode()) {
      throw new SfError(messages.getMessage('deviceWarning'), 'DEVICE_WARNING');
    }

    if (await common.shouldExitCommand(flags['no-prompt'])) return {};

    const oauthConfig: OAuth2Config = {
      loginUrl: await common.resolveLoginUrl(flags['instance-url']?.href),
      clientId: flags['client-id'],
      redirectUri: process.env.SF_AUTH_REDIRECT_URL ?? undefined,
      ...(flags['client-id']
        ? { clientSecret: await this.secretPrompt({ message: commonMessages.getMessage('clientSecretStdin') }) }
        : {}),
    };

    try {
      const authInfo = await this.executeLoginFlow(oauthConfig, flags.browser);
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
      Logger.childFromRoot('LoginWebCommand').debug(err);
      if (err instanceof SfError && err.name === 'AuthCodeExchangeError') {
        err.message = messages.getMessage('invalidClientId', [err.message]);
      }
      throw err;
    }
  }

  // leave it because it's stubbed in the test
  // eslint-disable-next-line class-methods-use-this
  private async executeLoginFlow(oauthConfig: OAuth2Config, browser?: string): Promise<AuthInfo> {
    const oauthServer = await WebOAuthServer.create({ oauthConfig });
    await oauthServer.start();
    const app = browser && browser in apps ? (browser as AppName) : undefined;
    const openOptions = app ? { app: { name: apps[app] }, wait: false } : { wait: false };
    await open(oauthServer.getAuthorizationUrl(), openOptions);
    return oauthServer.authorizeAndSave();
  }
}

const isSFDXContainerMode = (): boolean => {
  const env = new Env();
  return env.getBoolean('SFDX_CONTAINER_MODE');
};
