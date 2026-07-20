/*
 * Copyright 2026, Salesforce, Inc.
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

import { Flags, loglevel, SfCommand } from '@salesforce/sf-plugins-core';
import {
  AuthFields,
  AuthInfo,
  envVars,
  Messages,
  matchesAccessToken,
  SfError,
  StateAggregator,
} from '@salesforce/core';
import { env } from '@salesforce/kit';
import { InferredFlags } from '@oclif/core/interfaces';
import common from '../../../common.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'accesstoken.store');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');
const secretsMessages = Messages.loadMessages('@salesforce/plugin-auth', 'secrets-redacted');

const ACCESS_TOKEN_FORMAT = '"<org id>!<accesstoken>"';

export default class LoginAccessToken extends SfCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly deprecateAliases = true;
  public static readonly aliases = ['force:auth:accesstoken:store', 'auth:accesstoken:store'];

  public static readonly flags = {
    'instance-url': Flags.url({
      char: 'r',
      summary: commonMessages.getMessage('flags.instance-url.summary'),
      description: commonMessages.getMessage('flags.instance-url.description'),
      required: true,
      deprecateAliases: true,
      aliases: ['instanceurl'],
    }),
    'set-default-dev-hub': Flags.boolean({
      char: 'd',
      summary: commonMessages.getMessage('flags.set-default-dev-hub.summary'),
      default: false,
      deprecateAliases: true,
      aliases: ['setdefaultdevhub', 'setdefaultdevhubusername'],
    }),
    'set-default': Flags.boolean({
      char: 's',
      summary: commonMessages.getMessage('flags.set-default.summary'),
      default: false,
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
      default: false,
      deprecateAliases: true,
      aliases: ['noprompt'],
    }),
    loglevel,
  };

  private flags!: InferredFlags<typeof LoginAccessToken.flags>;

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(LoginAccessToken);
    this.flags = flags;
    const instanceUrl = flags['instance-url'].href;
    const accessToken = await this.getAccessToken();
    const authInfo = await this.getUserInfo(accessToken, instanceUrl);
    return this.storeAuthFromAccessToken(authInfo);
  }

  // because stubbed on the test (instead of stubbing in core)
  // eslint-disable-next-line class-methods-use-this
  private async getUserInfo(accessToken: string, instanceUrl: string): Promise<AuthInfo> {
    return AuthInfo.create({ accessTokenOptions: { accessToken, instanceUrl, loginUrl: instanceUrl } });
  }

  private async storeAuthFromAccessToken(authInfo: AuthInfo): Promise<AuthFields> {
    if (await this.overwriteAuthInfo(authInfo.getUsername())) {
      await this.saveAuthInfo(authInfo);
      const successMsg = commonMessages.getMessage('authorizeCommandSuccess', [
        authInfo.getUsername(),
        authInfo.getFields().orgId,
      ]);
      this.logSuccess(successMsg);
    }

    // TODO: Remove env var workaround
    if (this.jsonEnabled()) {
      if (envVars.getBoolean('SF_TEMP_SHOW_SECRETS', false)) {
        this.warn(secretsMessages.getMessage('temp.envVarIsSet', ['sf org login access-token']));
      } else {
        this.warn(secretsMessages.getMessage('temp.envVarWorkaround', ['sf org login access-token']));
      }
    }

    return common.redactAuthFields(authInfo.getFields(true));
  }

  private async saveAuthInfo(authInfo: AuthInfo): Promise<void> {
    await authInfo.save();
    await authInfo.handleAliasAndDefaultSettings({
      alias: this.flags.alias,
      setDefault: this.flags['set-default'],
      setDefaultDevHub: this.flags['set-default-dev-hub'],
    });
    await AuthInfo.identifyPossibleScratchOrgs(authInfo.getFields(true), authInfo);
  }

  private async overwriteAuthInfo(username: string): Promise<boolean> {
    // Only prompt to overwrite when we can actually receive an answer. When stdin is not a
    // TTY (e.g. the token was piped in) the interactive prompt has no input to read and would
    // reject with "User force closed the prompt with 13 null", so treat it like --no-prompt.
    if (!this.flags['no-prompt'] && process.stdin.isTTY) {
      const stateAggregator = await StateAggregator.getInstance();
      if (await stateAggregator.orgs.exists(username)) {
        return this.confirm({ message: messages.getMessage('overwriteAccessTokenAuthUserFile', [username]) });
      }
    }
    return true;
  }

  private async getAccessToken(): Promise<string> {
    const accessToken =
      env.getString('SF_ACCESS_TOKEN') ?? env.getString('SFDX_ACCESS_TOKEN') ?? (await this.resolveAccessToken());
    if (!matchesAccessToken(accessToken)) {
      throw new SfError(messages.getMessage('invalidAccessTokenFormat', [ACCESS_TOKEN_FORMAT]));
    }
    return accessToken;
  }

  private async resolveAccessToken(): Promise<string> {
    if (this.flags['no-prompt']) {
      // will throw when validating
      return '';
    }
    // When stdin is piped (not a TTY) the interactive secret prompt can't be used reliably,
    // so read the token directly from the stream. This is the CI/CD "pipe the token" workflow.
    if (!process.stdin.isTTY) {
      return readPipedStdin();
    }
    return this.secretPrompt({ message: commonMessages.getMessage('accessTokenStdin') });
  }
}

/**
 * Read all data piped to stdin and return it trimmed. Returns '' if nothing was piped.
 *
 * A timeout guards against a stdin stream that is opened but never sends data or EOF (e.g. a
 * pipe inherited from a supervisor process, or a terminal that reports a non-TTY stdin such as
 * Git Bash/mintty on Windows), which would otherwise hang the command forever. On timeout the
 * stream listeners are removed so no read is left dangling.
 */
async function readPipedStdin(ms = 60_000): Promise<string> {
  const stdin = process.stdin;
  const chunks: string[] = [];

  return new Promise<string>((resolve, reject) => {
    const onData = (chunk: Buffer | string): void => {
      chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    };
    const cleanup = (): void => {
      clearTimeout(timer);
      stdin.removeListener('data', onData);
      stdin.removeListener('end', onEnd);
      stdin.removeListener('error', onError);
    };
    const onEnd = (): void => {
      cleanup();
      resolve(chunks.join('').trim());
    };
    const onError = (err: Error): void => {
      cleanup();
      reject(err);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new SfError(messages.getMessage('stdinTimeout')));
    }, ms);
    timer.unref();

    stdin.on('data', onData);
    stdin.once('end', onEnd);
    stdin.once('error', onError);
  });
}
