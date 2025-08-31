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

import fs from 'node:fs/promises';
import { Flags, SfCommand, loglevel } from '@salesforce/sf-plugins-core';
import { AuthFields, AuthInfo, Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { parseJson } from '@salesforce/kit';
import common from '../../../common.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'sfdxurl.store');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

const AUTH_URL_FORMAT = 'force://<clientId>:<clientSecret>:<refreshToken>@<instanceUrl>';

type AuthJson = AnyJson & {
  result?: AnyJson & { sfdxAuthUrl: string };
  sfdxAuthUrl: string;
};
export default class LoginSfdxUrl extends SfCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description', [AUTH_URL_FORMAT]);
  public static readonly examples = messages.getMessages('examples');
  public static readonly aliases = ['force:auth:sfdxurl:store', 'auth:sfdxurl:store'];
  public static readonly deprecateAliases = true;

  public static readonly flags = {
    'sfdx-url-file': Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.sfdx-url-file.summary'),
      required: false,
      deprecateAliases: true,
      aliases: ['sfdxurlfile'],
      exactlyOne: ['sfdx-url-file', 'sfdx-url-stdin'],
    }),
    'sfdx-url-stdin': Flags.file({
      char: 'u',
      summary: messages.getMessage('flags.sfdx-url-stdin.summary'),
      required: false,
      deprecateAliases: true,
      aliases: ['sfdxurlstdin'],
      allowStdin: 'only',
      exactlyOne: ['sfdx-url-file', 'sfdx-url-stdin'],
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
    if (await common.shouldExitCommand(flags['no-prompt'])) return {};

    const authFile = flags['sfdx-url-file'];
    const authStdin = flags['sfdx-url-stdin'];
    let sfdxAuthUrl: string;

    if (authFile) {
      sfdxAuthUrl = authFile.endsWith('.json') ? await getUrlFromJson(authFile) : await fs.readFile(authFile, 'utf8');

      if (!sfdxAuthUrl) {
        throw new Error(
          `Error getting the SFDX authorization URL from file ${authFile}. Ensure it meets the description shown in the documentation (--help) for this command.`
        );
      }
    } else if (authStdin) {
      sfdxAuthUrl = authStdin;
    } else {
      throw new Error('SFDX authorization URL not found.');
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
  const jsonContents = await fs.readFile(authFile, 'utf8');
  const authFileJson = parseJson(jsonContents) as AuthJson;
  return authFileJson.result?.sfdxAuthUrl ?? authFileJson.sfdxAuthUrl;
};
