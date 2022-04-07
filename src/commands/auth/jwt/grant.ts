/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthFields, AuthInfo, AuthRemover, Messages, SfError } from '@salesforce/core';
import { get, getString, Optional } from '@salesforce/ts-types';
import { Prompts } from '../../../prompts';
import { Common } from '../../../common';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'jwt.grant');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export default class Grant extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static aliases = ['force:auth:jwt:grant'];

  public static readonly flagsConfig: FlagsConfig = {
    username: flags.string({
      char: 'u',
      description: messages.getMessage('username'),
      required: true,
    }),
    jwtkeyfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('key'),
      required: true,
    }),
    clientid: flags.string({
      char: 'i',
      description: commonMessages.getMessage('clientId'),
      required: true,
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
    noprompt: flags.boolean({
      char: 'p',
      description: commonMessages.getMessage('noPromptAuth'),
      required: false,
      hidden: true,
    }),
  };

  public async run(): Promise<AuthFields> {
    let result: AuthFields = {};

    if (await Prompts.shouldExitCommand(this.ux, this.flags.noprompt)) return {};

    try {
      const authInfo = await this.initAuthInfo();
      await authInfo.handleAliasAndDefaultSettings({
        alias: this.flags.setalias as string,
        setDefault: this.flags.setdefaultusername as boolean,
        setDefaultDevHub: this.flags.setdefaultdevhubusername as boolean,
      });
      result = authInfo.getFields(true);
      await AuthInfo.identifyPossibleScratchOrgs(result, authInfo);
    } catch (err) {
      const msg = getString(err, 'message');
      throw messages.createError('JwtGrantError', [msg]);
    }

    const successMsg = commonMessages.getMessage('authorizeCommandSuccess', [result.username, result.orgId]);
    this.ux.log(successMsg);
    return result;
  }

  private async initAuthInfo(): Promise<AuthInfo> {
    const oauth2OptionsBase = {
      clientId: this.flags.clientid as string,
      privateKeyFile: this.flags.jwtkeyfile as string,
    };

    const loginUrl = await Common.resolveLoginUrl(get(this.flags.instanceurl, 'href', null) as Optional<string>);

    const oauth2Options = loginUrl ? Object.assign(oauth2OptionsBase, { loginUrl }) : oauth2OptionsBase;

    let authInfo: AuthInfo;
    try {
      authInfo = await AuthInfo.create({
        username: this.flags.username as string,
        oauth2Options,
      });
    } catch (error) {
      const err = error as SfError;
      if (err.name === 'AuthInfoOverwriteError') {
        this.logger.debug('Auth file already exists. Removing and starting fresh.');
        const remover = await AuthRemover.create();
        await remover.removeAuth(this.flags.username);
        authInfo = await AuthInfo.create({
          username: this.flags.username as string,
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
