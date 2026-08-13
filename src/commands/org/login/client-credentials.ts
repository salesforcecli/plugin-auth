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

import { Flags, SfCommand, loglevel } from '@salesforce/sf-plugins-core';
import { AuthFields, AuthInfo, AuthRemover, envVars, Logger, Messages, SfError } from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import common from '../../../common.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'client.credentials');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');
const secretsMessages = Messages.loadMessages('@salesforce/plugin-auth', 'secrets-redacted');

type ClientCredentialsTokenResponse = {
  accessToken: string;
  instanceUrl: string;
};

export default class LoginClientCredentials extends SfCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    username: Flags.string({
      // eslint-disable-next-line sf-plugin/dash-o
      char: 'o',
      summary: messages.getMessage('flags.username.summary'),
      required: true,
    }),
    'client-secret': Flags.string({
      summary: messages.getMessage('flags.client-secret.summary'),
      required: true,
    }),
    'client-id': Flags.string({
      char: 'i',
      summary: commonMessages.getMessage('flags.client-id.summary'),
      required: true,
    }),
    'instance-url': Flags.url({
      char: 'r',
      summary: commonMessages.getMessage('flags.instance-url.summary'),
      description: commonMessages.getMessage('flags.instance-url.description'),
    }),
    'set-default-dev-hub': Flags.boolean({
      char: 'd',
      summary: commonMessages.getMessage('flags.set-default-dev-hub.summary'),
    }),
    'set-default': Flags.boolean({
      char: 's',
      summary: commonMessages.getMessage('flags.set-default.summary'),
    }),
    alias: Flags.string({
      char: 'a',
      summary: commonMessages.getMessage('flags.alias.summary'),
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: commonMessages.getMessage('flags.no-prompt.summary'),
      required: false,
      hidden: true,
    }),
    loglevel,
  };
  private flags!: Interfaces.InferredFlags<typeof LoginClientCredentials.flags>;
  private logger = Logger.childFromRoot(this.constructor.name);

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(LoginClientCredentials);
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
      const msg = err instanceof Error ? `${err.name}::${err.message}` : typeof err === 'string' ? err : 'UNKNOWN';
      throw SfError.create({
        message: messages.getMessage('ClientCredentialsGrantError', [msg]),
        name: 'ClientCredentialsGrantError',
        ...(err instanceof Error ? { cause: err } : {}),
      });
    }

    const successMsg = commonMessages.getMessage('authorizeCommandSuccess', [result.username, result.orgId]);
    this.logSuccess(successMsg);

    // TODO: Remove env var workaround
    if (this.jsonEnabled()) {
      if (envVars.getBoolean('SF_TEMP_SHOW_SECRETS', false)) {
        this.warn(secretsMessages.getMessage('temp.envVarIsSet', ['sf org login client-credentials']));
      } else {
        this.warn(secretsMessages.getMessage('temp.envVarWorkaround', ['sf org login client-credentials']));
      }
    }

    return common.redactAuthFields(result);
  }

  private async initAuthInfo(): Promise<AuthInfo> {
    const loginUrl = await common.resolveLoginUrl(this.flags['instance-url']?.href);
    const token = await this.requestClientCredentialsToken(loginUrl);

    const accessTokenOptions = {
      accessToken: token.accessToken,
      instanceUrl: token.instanceUrl,
      loginUrl,
    };

    let authInfo: AuthInfo;
    try {
      authInfo = await AuthInfo.create({
        username: this.flags.username,
        accessTokenOptions,
      });
    } catch (error) {
      const err = error as SfError;
      if (err.name === 'AuthInfoOverwriteError') {
        this.logger.debug('Auth file already exists. Removing and starting fresh.');
        const remover = await AuthRemover.create();
        await remover.removeAuth(this.flags.username);
        authInfo = await AuthInfo.create({
          username: this.flags.username,
          accessTokenOptions,
        });
      } else {
        throw err;
      }
    }
    await authInfo.save({
      clientId: this.flags['client-id'],
      clientSecret: this.flags['client-secret'],
    });
    return authInfo;
  }

  /**
   * Exchange the connected app client id and secret for an access token.
   * The secret is sent in the POST body, never the query string.
   */
  private async requestClientCredentialsToken(loginUrl: string): Promise<ClientCredentialsTokenResponse> {
    const base = loginUrl.endsWith('/') ? loginUrl : `${loginUrl}/`;
    const tokenUrl = new URL('services/oauth2/token', base);
    if (tokenUrl.protocol !== 'https:') {
      throw new SfError(messages.getMessage('httpsRequired'), 'ClientCredentialsAuthError');
    }

    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('client_id', this.flags['client-id']);
    body.set('client_secret', this.flags['client-secret']);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const payload = await parseTokenResponse(response);
    if (!response.ok) {
      const detail = payload.errorDescription ?? payload.error ?? `HTTP ${response.status}`;
      throw new SfError(detail, 'ClientCredentialsAuthError');
    }
    if (!payload.accessToken || !payload.instanceUrl) {
      throw new SfError(messages.getMessage('invalidTokenResponse'), 'ClientCredentialsAuthError');
    }

    return {
      accessToken: payload.accessToken,
      instanceUrl: payload.instanceUrl,
    };
  }
}

type TokenResponseBody = {
  accessToken?: string;
  instanceUrl?: string;
  error?: string;
  errorDescription?: string;
};

const parseTokenResponse = async (response: Response): Promise<TokenResponseBody> => {
  try {
    const raw = (await response.json()) as Record<string, unknown>;
    return {
      accessToken: typeof raw.access_token === 'string' ? raw.access_token : undefined,
      instanceUrl: typeof raw.instance_url === 'string' ? raw.instance_url : undefined,
      error: typeof raw.error === 'string' ? raw.error : undefined,
      errorDescription: typeof raw.error_description === 'string' ? raw.error_description : undefined,
    };
  } catch {
    return {};
  }
};
