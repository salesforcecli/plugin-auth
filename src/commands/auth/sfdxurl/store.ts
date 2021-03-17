/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthFields, AuthInfo, fs, Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { Prompts } from '../../../prompts';
import { Common } from '../../../common';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'sfdxurl.store');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

const AUTH_URL_FORMAT1 = 'force://<refreshToken>@<instanceUrl>';
const AUTH_URL_FORMAT2 = 'force://<clientId>:<clientSecret>:<refreshToken>@<instanceUrl>';

type AuthJson = AnyJson & {
  result?: AnyJson & { sfdxAuthUrl: string };
  sfdxAuthUrl: string;
};
export default class Store extends SfdxCommand {
  public static readonly description = messages.getMessage('description', [AUTH_URL_FORMAT1, AUTH_URL_FORMAT2]);
  public static readonly examples = messages.getMessage('examples').split(os.EOL);
  public static aliases = ['force:auth:sfdxurl:store'];

  public static readonly flagsConfig: FlagsConfig = {
    sfdxurlfile: flags.filepath({
      char: 'f',
      description: messages.getMessage('file'),
      required: true,
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
    if (await Prompts.shouldExitCommand(this.ux, this.flags.noprompt)) return {};

    const authFile = this.flags.sfdxurlfile as string;

    const sfdxAuthUrl = authFile.endsWith('.json')
      ? await this.getUrlFromJson(authFile)
      : await fs.readFile(authFile, 'utf8');

    if (!sfdxAuthUrl) {
      throw new Error(
        `Error getting the auth URL from file ${authFile}. Please ensure it meets the description shown in the documentation for this command.`
      );
    }

    const oauth2Options = AuthInfo.parseSfdxAuthUrl(sfdxAuthUrl);

    const authInfo = await AuthInfo.create({ oauth2Options });
    await authInfo.save();

    await Common.handleSideEffects(authInfo, this.flags);

    const result = authInfo.getFields(true);
    const successMsg = commonMessages.getMessage('authorizeCommandSuccess', [result.username, result.orgId]);
    this.ux.log(successMsg);
    return result;
  }

  private async getUrlFromJson(authFile: string): Promise<string> {
    const authFileJson = (await fs.readJson(authFile)) as AuthJson;
    return authFileJson.result?.sfdxAuthUrl || authFileJson.sfdxAuthUrl;
  }
}
