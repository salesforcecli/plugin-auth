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
import { AuthFields, Messages, SfError } from '@salesforce/core';
import { env } from '@salesforce/kit';
import { Interfaces } from '@oclif/core';
import common from '../../../common.js';
import AccessToken from './access-token.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'client.credentials');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

type ClientCredentialsTokenResponse = {
  accessToken: string;
  instanceUrl: string;
};

export default class LoginClientCredentials extends SfCommand<AuthFields> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
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

  private static getClientSecret(): string {
    const clientSecret = env.getString('SF_CLIENT_SECRET');
    if (!clientSecret) {
      throw new SfError(messages.getMessage('clientSecretMissingResponse'));
    }
    return clientSecret;
  }

  public async run(): Promise<AuthFields> {
    const { flags } = await this.parse(LoginClientCredentials);
    this.flags = flags;

    try {
      return await this.performClientCredentialsLogin();
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}::${err.message}` : typeof err === 'string' ? err : 'UNKNOWN';
      throw SfError.create({
        message: messages.getMessage('ClientCredentialsGrantError', [msg]),
        name: 'ClientCredentialsGrantError',
        ...(err instanceof Error ? { cause: err } : {}),
      });
    } finally {
      env.unset('SF_ACCESS_TOKEN');
    }
  }

  private async performClientCredentialsLogin(): Promise<AuthFields> {
    const loginUrl = await common.resolveLoginUrl(this.flags['instance-url']?.href);
    const tokenResponse = await this.requestClientCredentialsToken(loginUrl);

    env.setString('SF_ACCESS_TOKEN', tokenResponse.accessToken);

    // the AccessToken command, and other commands in general
    // don't play nice with extra args being passed to them, so we strip out
    // the one extra flag prior to calling that command
    const accessTokenArgs = this.argv.filter(
      (arg, index, args) =>
        !['-i', '--client-id'].includes(arg) &&
        !arg.startsWith('-i=') &&
        !arg.startsWith('--client-id=') &&
        !['-i', '--client-id'].includes(args[index - 1] ?? '')
    );
    const response = await new AccessToken(accessTokenArgs, this.config).run();
    return response;
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
    body.set('client_secret', LoginClientCredentials.getClientSecret());

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
