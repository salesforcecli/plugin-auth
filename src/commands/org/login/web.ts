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
    // TODO: flag name is too generic, rename before final review
    app: Flags.string({
      summary: messages.getMessage('flags.app.summary'),
      dependsOn: ['username'],
    }),
    username: Flags.string({
      summary: messages.getMessage('flags.username.summary'),
      dependsOn: ['app'],
    }),
  };

  private logger = Logger.childFromRoot(this.constructor.name);

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(LoginWeb);
    if (isContainerMode()) {
      throw new SfError(messages.getMessage('deviceWarning'), 'DEVICE_WARNING');
    }

    if (await common.shouldExitCommand(flags['no-prompt'])) return {};

    // Add ca/eca to already existing auth info.
    if (flags.app && flags.username) {
      // 1. get username authinfo
      const userAuthInfo = await AuthInfo.create({
        username: flags.username,
      });

      const authFields = userAuthInfo.getFields(true);

      // 2. web-auth and save name, clientId, accessToken, and refreshToken in `apps` object
      const oauthConfig: OAuth2Config = {
        // TODO: handle clientSecret prompt
        loginUrl: authFields.loginUrl,
        clientId: flags['client-id'],
      };

      await this.executeLoginFlow(oauthConfig, flags.browser, flags.app, flags.username);

      // TODO: add successful app auth msg
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
  private async executeLoginFlow(
    oauthConfig: OAuth2Config,
    browser?: string,
    // TODO: rename
    capp?: string,
    username?: string
  ): Promise<AuthInfo> {
    // TODO: document how this works:
    // 1st case: new user, server creates auth file with new creds
    // 2nd case: existing auth file, server gets tokens and adds it to the file
    //
    // WebOAuthServer types should block any other combination of object params.
    const oauthServer = await WebOAuthServer.create({ oauthConfig, app: capp, username });
    await oauthServer.start();
    const app = browser && browser in apps ? (browser as AppName) : undefined;
    const openOptions = app ? { app: { name: apps[app] }, wait: false } : { wait: false };
    this.logger.debug(`Opening browser ${app ?? ''}`);
    // the following `childProcess` wrapper is needed to catch when `open` fails to open a browser.
    await open(oauthServer.getAuthorizationUrl(), openOptions).then(
      (childProcess) =>
        new Promise((resolve, reject) => {
          // https://nodejs.org/api/child_process.html#event-exit
          childProcess.on('exit', (code) => {
            if (code && code > 0) {
              this.logger.debug(`Failed to open browser ${app ?? ''}`);
              reject(messages.createError('error.cannotOpenBrowser', [app], [app]));
            }
            // If the process exited, code is the final exit code of the process, otherwise null.
            // resolve on null just to be safe, worst case the browser didn't open and the CLI just hangs.
            if (code === null || code === 0) {
              this.logger.debug(`Successfully opened browser ${app ?? ''}`);
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
  return env.getBoolean('SF_CONTAINER_MODE', env.getBoolean('SFDX_CONTAINER_MODE'));
};
