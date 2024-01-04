/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags, SfCommand, loglevel } from '@salesforce/sf-plugins-core';
import { AuthFields, AuthInfo, AuthRemover, Logger, Messages, SfError } from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import common from '../../../common.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'jwt.grant');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export default class LoginJwt extends SfCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:auth:jwt:grant', 'auth:jwt:grant'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    username: Flags.string({
      // eslint-disable-next-line sf-plugin/dash-o
      char: 'o',
      summary: messages.getMessage('flags.username.summary'),
      required: true,
      deprecateAliases: true,
      aliases: ['u'],
    }),
    'jwt-key-file': Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.jwt-key-file.summary'),
      required: true,
      deprecateAliases: true,
      aliases: ['jwtkeyfile', 'keyfile'],
    }),
    'client-id': Flags.string({
      char: 'i',
      summary: commonMessages.getMessage('flags.client-id.summary'),
      required: true,
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
      aliases: ['setdefaultdevhub', 'setdefaultdevhubusername', 'v'],
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
  private flags!: Interfaces.InferredFlags<typeof LoginJwt.flags>;
  private logger = Logger.childFromRoot(this.constructor.name);

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(LoginJwt);
    this.flags = flags;
    let result: AuthFields = {};

    if (await common.shouldExitCommand(flags['no-prompt'])) return {};

    try {
      const authInfo = await this.initAuthInfo();
      await authInfo.handleAliasAndDefaultSettings({
        alias: flags.alias,
        setDefault: flags['set-default'],
        setDefaultDevHub: flags['set-default-dev-hub'],
      });
      result = authInfo.getFields(true);
      await AuthInfo.identifyPossibleScratchOrgs(result, authInfo);
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      throw messages.createError('JwtGrantError', [err.message]);
    }

    const successMsg = commonMessages.getMessage('authorizeCommandSuccess', [result.username, result.orgId]);
    this.logSuccess(successMsg);
    return result;
  }

  private async initAuthInfo(): Promise<AuthInfo> {
    const oauth2OptionsBase = {
      clientId: this.flags['client-id'],
      privateKeyFile: this.flags['jwt-key-file'],
    };

    const loginUrl = await common.resolveLoginUrl(this.flags['instance-url']?.href);

    const oauth2Options = loginUrl ? Object.assign(oauth2OptionsBase, { loginUrl }) : oauth2OptionsBase;

    let authInfo: AuthInfo;
    try {
      authInfo = await AuthInfo.create({
        username: this.flags.username,
        oauth2Options,
      });
    } catch (error) {
      const err = error as SfError;
      if (err.name === 'AuthInfoOverwriteError') {
        this.logger.debug('Auth file already exists. Removing and starting fresh.');
        const remover = await AuthRemover.create();
        await remover.removeAuth(this.flags.username);
        authInfo = await AuthInfo.create({
          username: this.flags.username,
          oauth2Options,
        });
      } else {
        throw err;
      }
    }
    await authInfo.save();
    return authInfo;
  }
}
