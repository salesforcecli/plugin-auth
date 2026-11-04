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

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuth2 } from '@jsforce/jsforce-node';
import { AuthInfo, Messages, OAuth2Config, SfError } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'web.login');

/** Client id of the CLI's built-in connected app, the same default that WebOAuthServer uses. */
export const DEFAULT_CLIENT_ID = 'PlatformCLI';

/** The parts of core's (unexported) JwtOAuth2Config that the authorization code flow needs. */
export type ManualOAuthConfig = OAuth2Config & { state: string; scope?: string; authCode?: string };

export type ManualLoginSession = {
  /** Salesforce authorization URL with the PKCE challenge and state. Safe to print. */
  authUrl: string;
  /** Pass to AuthInfo.create as oauth2Options once authCode is set. */
  oauthConfig: ManualOAuthConfig;
  /** Holds the PKCE code verifier. Pass to AuthInfo.create as oauth2. Never log it. */
  oauth2: OAuth2;
};

/** Builds an authorization code + PKCE request the same way WebOAuthServer does, without starting a server. */
export const createManualLoginSession = (
  oauthConfig: OAuth2Config & { scope?: string },
  redirectUri: string
): ManualLoginSession => {
  const config: ManualOAuthConfig = {
    ...oauthConfig,
    clientId: oauthConfig.clientId ?? DEFAULT_CLIENT_ID,
    redirectUri,
    useVerifier: true,
    state: randomBytes(32).toString('hex'),
  };
  // jsforce generates the PKCE verifier in the constructor; the same instance must do the token exchange.
  const oauth2 = new OAuth2(config);
  return { authUrl: AuthInfo.getAuthorizationUrl(config, oauth2), oauthConfig: config, oauth2 };
};

/** Validates a pasted callback URL against the redirect URI and state of this login attempt and returns the code. */
export const parseCallbackUrl = (input: string, expected: { redirectUri: string; state: string }): string => {
  const trimmed = input.trim();
  if (!trimmed) throw messages.createError('error.emptyCallbackUrl');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw messages.createError('error.malformedCallbackUrl');
  }

  const expectedUrl = new URL(expected.redirectUri);
  if (url.origin !== expectedUrl.origin || url.pathname !== expectedUrl.pathname) {
    throw messages.createError('error.unexpectedRedirectUri', [expectedUrl.origin + expectedUrl.pathname]);
  }

  const state = url.searchParams.get('state') ?? '';
  if (!state || !safeEqual(state, expected.state)) throw messages.createError('error.stateMismatch');

  const error = url.searchParams.get('error');
  if (error) {
    throw new SfError(sanitize(url.searchParams.get('error_description') ?? error), 'OAuthError');
  }

  const code = url.searchParams.get('code');
  if (!code) throw messages.createError('error.missingAuthCode');
  return code;
};

/** The error text comes from pasted input: drop control characters and cap the length before printing it. */
// eslint-disable-next-line no-control-regex
const sanitize = (text: string): string => text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 300);

const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};
