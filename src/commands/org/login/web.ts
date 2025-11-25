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
    'client-app': Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.client-app.summary'),
      dependsOn: ['username'],
    }),
    username: Flags.string({
      summary: messages.getMessage('flags.username.summary'),
      dependsOn: ['client-app'],
    }),
    scopes: Flags.string({
      summary: messages.getMessage('flags.scopes.summary'),
    }),
  };

  private logger = Logger.childFromRoot(this.constructor.name);

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(LoginWeb);
    if (isContainerMode()) {
      throw new SfError(messages.getMessage('error.headlessWebAuth'));
    }

    if (await common.shouldExitCommand(flags['no-prompt'])) return {};

    // Add ca/eca to already existing auth info.
    if (flags['client-app'] && flags.username) {
      // 1. get username authinfo
      const userAuthInfo = await AuthInfo.create({
        username: flags.username,
      });

      const authFields = userAuthInfo.getFields(true);

      // 2. web-auth and save name, clientId, accessToken, and refreshToken in `apps` object
      const oauthConfig: OAuth2Config = {
        loginUrl: authFields.loginUrl,
        clientId: flags['client-id'],
        ...{ clientSecret: await this.secretPrompt({ message: commonMessages.getMessage('clientSecretStdin') }) },
      };

      await this.executeLoginFlow(oauthConfig, flags.browser, flags['client-app'], flags.username, flags.scopes);

      this.logSuccess(messages.getMessage('linkedClientApp', [flags['client-app'], flags.username]));
      return userAuthInfo.getFields(true);
    }

    const oauthConfig: OAuth2Config = {
      loginUrl: await common.resolveLoginUrl(flags['instance-url']?.href),
      clientId: flags['client-id'],
      ...(flags['client-id']
        ? { clientSecret: await this.secretPrompt({ message: commonMessages.getMessage('clientSecretStdin') }) }
        : {}),
    };

    try {
      const authInfo = await this.executeLoginFlow(oauthConfig, flags.browser, flags.scopes);
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
  private async executeLoginFlow(
    oauthConfig: OAuth2Config,
    browser?: string,
    app?: string,
    username?: string,
    scopes?: string
  ): Promise<AuthInfo> {
    // The server handles 2 possible auth scenarios:
    // a. 1st time auth, creates auth file.
    // b. Add CA/ECA to existing auth.
    const oauthServer = await WebOAuthServer.create({
      oauthConfig: {
        ...oauthConfig,
        scope: scopes,
      },
      clientApp: app,
      username,
    });
    await oauthServer.start();
    const browserApp = browser && browser in apps ? (browser as AppName) : undefined;
    const openOptions = browserApp ? { app: { name: apps[browserApp] }, wait: false } : { wait: false };
    this.logger.debug(`Opening browser ${browserApp ?? ''}`);
    // the following `childProcess` wrapper is needed to catch when `open` fails to open a browser.
    await open(oauthServer.getAuthorizationUrl(), openOptions).then(
      (childProcess) =>
        new Promise((resolve, reject) => {
          // https://nodejs.org/api/child_process.html#event-exit
          childProcess.on('exit', (code) => {
            if (code && code > 0) {
              this.logger.debug(`Failed to open browser ${browserApp ?? ''}`);
              reject(messages.createError('error.cannotOpenBrowser', [browserApp], [browserApp]));
            }
            // If the process exited, code is the final exit code of the process, otherwise null.
            // resolve on null just to be safe, worst case the browser didn't open and the CLI just hangs.
            if (code === null || code === 0) {
              this.logger.debug(`Successfully opened browser ${browserApp ?? ''}`);
              resolve(childProcess);
            }
          });
        })
    );
    return oauthServer.authorizeAndSave();
  }
}

const isContainerMode = (): boolean => {
  const env = new Env();
  const containerMode = env.getBoolean('SF_CONTAINER_MODE') || env.getBoolean('SFDX_CONTAINER_MODE');
  const codeBuilder = env.getBoolean('CODE_BUILDER');
  return containerMode && !codeBuilder;
};
