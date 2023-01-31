/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags } from '@salesforce/sf-plugins-core';
import { AuthFields, AuthInfo, AuthRemover, Logger, Messages, SfError } from '@salesforce/core';
import { get, getString, Optional } from '@salesforce/ts-types';
import { Interfaces } from '@oclif/core';
import { AuthBaseCommand } from '../../../prompts';
import { Common } from '../../../common';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'jwt.grant');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export default class Grant extends AuthBaseCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static aliases = ['force:auth:jwt:grant'];

  public static readonly flags = {
    'user-name': Flags.string({
      char: 'u',
      summary: messages.getMessage('username'),
      required: true,
      deprecateAliases: true,
      aliases: ['username'],
    }),
    'jwt-key-file': Flags.file({
      char: 'f',
      summary: messages.getMessage('key'),
      required: true,
      deprecateAliases: true,
      aliases: ['jwtkeyfile'],
    }),
    'client-id': Flags.string({
      char: 'i',
      summary: commonMessages.getMessage('clientId'),
      required: true,
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
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: commonMessages.getMessage('noPromptAuth'),
      required: false,
      hidden: true,
      deprecateAliases: true,
      aliases: ['noprompt'],
    }),
  };
  private flags: Interfaces.InferredFlags<typeof Grant.flags>;
  private logger = Logger.childFromRoot(this.constructor.name);

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(Grant);
    this.flags = flags;
    let result: AuthFields = {};

    if (await this.shouldExitCommand(flags['no-prompt'])) return {};

    try {
      const authInfo = await this.initAuthInfo();
      await authInfo.handleAliasAndDefaultSettings({
        alias: flags.setalias as string,
        setDefault: flags['set-default'],
        setDefaultDevHub: flags['set-default-dev-hub'],
      });
      result = authInfo.getFields(true);
      await AuthInfo.identifyPossibleScratchOrgs(result, authInfo);
    } catch (err) {
      const msg = getString(err, 'message');
      throw messages.createError('JwtGrantError', [msg]);
    }

    const successMsg = commonMessages.getMessage('authorizeCommandSuccess', [result.username, result.orgId]);
    this.log(successMsg);
    return result;
  }

  private async initAuthInfo(): Promise<AuthInfo> {
    const oauth2OptionsBase = {
      clientId: this.flags['client-id'],
      privateKeyFile: this.flags['jwt-key-file'],
    };

    const loginUrl = await Common.resolveLoginUrl(get(this.flags['instance-url'], 'href', null) as Optional<string>);

    const oauth2Options = loginUrl ? Object.assign(oauth2OptionsBase, { loginUrl }) : oauth2OptionsBase;

    let authInfo: AuthInfo;
    try {
      authInfo = await AuthInfo.create({
        username: this.flags['user-name'],
        oauth2Options,
      });
    } catch (error) {
      const err = error as SfError;
      if (err.name === 'AuthInfoOverwriteError') {
        this.logger.debug('Auth file already exists. Removing and starting fresh.');
        const remover = await AuthRemover.create();
        await remover.removeAuth(this.flags['user-name']);
        authInfo = await AuthInfo.create({
          username: this.flags['user-name'],
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
