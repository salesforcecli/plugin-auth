/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFile } from 'node:fs/promises';
import { Flags, loglevel } from '@salesforce/sf-plugins-core';
import { AuthFields, AuthInfo, Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { parseJson } from '@salesforce/kit';
import { AuthBaseCommand } from '../../../authBaseCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'sfdxurl.store');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

const AUTH_URL_FORMAT = 'force://<clientId>:<clientSecret>:<refreshToken>@<instanceUrl>';

type AuthJson = AnyJson & {
  result?: AnyJson & { sfdxAuthUrl: string };
  sfdxAuthUrl: string;
};
export default class LoginSfdxUrl extends AuthBaseCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description', [AUTH_URL_FORMAT]);
  public static readonly examples = messages.getMessages('examples');
  public static aliases = ['force:auth:sfdxurl:store', 'auth:sfdxurl:store'];

  public static readonly flags = {
    'sfdx-url-file': Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.sfdx-url-file.summary'),
      required: true,
      deprecateAliases: true,
      aliases: ['sfdxurlfile'],
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
    const { flags } = await this.parse(LoginSfdxUrl);
    if (await this.shouldExitCommand(flags['no-prompt'])) return {};

    const authFile = flags['sfdx-url-file'];

    const sfdxAuthUrl = authFile.endsWith('.json') ? await getUrlFromJson(authFile) : await readFile(authFile, 'utf8');

    if (!sfdxAuthUrl) {
      throw new Error(
        `Error getting the auth URL from file ${authFile}. Please ensure it meets the description shown in the documentation for this command.`
      );
    }

    const oauth2Options = AuthInfo.parseSfdxAuthUrl(sfdxAuthUrl);

    const authInfo = await AuthInfo.create({ oauth2Options });
    await authInfo.save();

    await authInfo.handleAliasAndDefaultSettings({
      alias: flags.alias,
      setDefault: flags['set-default'],
      setDefaultDevHub: flags['set-default-dev-hub'],
    });

    // ensure the clientSecret field... even if it is empty
    const result = { clientSecret: '', ...authInfo.getFields(true) };
    await AuthInfo.identifyPossibleScratchOrgs(result, authInfo);

    const successMsg = commonMessages.getMessage('authorizeCommandSuccess', [result.username, result.orgId]);
    this.logSuccess(successMsg);
    return result;
  }
}

const getUrlFromJson = async (authFile: string): Promise<string> => {
  const jsonContents = await readFile(authFile, 'utf8');
  const authFileJson = parseJson(jsonContents) as AuthJson;
  return authFileJson.result?.sfdxAuthUrl ?? authFileJson.sfdxAuthUrl;
};
