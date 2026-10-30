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

import { createRequire } from 'node:module';
import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import { OAuth2 } from '@jsforce/jsforce-node';
import { createManualLoginSession, DEFAULT_CLIENT_ID, parseCallbackUrl } from '../src/manualWebLogin.js';

const redirectUri = 'http://localhost:1717/OauthRedirect';
const loginUrl = 'https://login.salesforce.com';

const expectSfError = (fn: () => unknown, name: string): SfError => {
  try {
    fn();
  } catch (err) {
    expect(err).to.be.instanceOf(SfError);
    expect((err as SfError).name).to.equal(name);
    return err as SfError;
  }
  throw new Error(`expected ${name} to be thrown`);
};

describe('manualWebLogin', () => {
  describe('createManualLoginSession', () => {
    it('builds an authorization code + PKCE URL for the default connected app', () => {
      const session = createManualLoginSession({ loginUrl }, redirectUri);
      const url = new URL(session.authUrl);
      expect(url.origin + url.pathname).to.equal('https://login.salesforce.com/services/oauth2/authorize');
      expect(url.searchParams.get('response_type')).to.equal('code');
      expect(url.searchParams.get('client_id')).to.equal(DEFAULT_CLIENT_ID);
      expect(url.searchParams.get('redirect_uri')).to.equal(redirectUri);
      expect(url.searchParams.get('code_challenge')).to.match(/^[A-Za-z0-9_-]{43}$/);
      expect(url.searchParams.get('state')).to.equal(session.oauthConfig.state);
      expect(session.oauthConfig.state).to.match(/^[0-9a-f]{64}$/);
      expect(url.searchParams.get('prompt')).to.equal('login');
      expect(url.searchParams.get('scope')).to.equal('refresh_token api web');
    });

    it('uses fresh state and PKCE values per session and never puts the verifier in the URL', () => {
      const a = createManualLoginSession({ loginUrl }, redirectUri);
      const b = createManualLoginSession({ loginUrl }, redirectUri);
      expect(a.oauthConfig.state).to.not.equal(b.oauthConfig.state);
      expect(new URL(a.authUrl).searchParams.get('code_challenge')).to.not.equal(
        new URL(b.authUrl).searchParams.get('code_challenge')
      );
      const verifier = (a.oauth2 as unknown as { codeVerifier: string }).codeVerifier;
      expect(verifier).to.be.a('string').with.length.greaterThan(40);
      expect(a.authUrl).to.not.include(verifier);
    });

    it('honours a custom instance url, client id, client secret and scopes', () => {
      const session = createManualLoginSession(
        { loginUrl: 'https://test.salesforce.com', clientId: 'MyApp', clientSecret: 'shh', scope: 'api sfap_api' },
        redirectUri
      );
      const url = new URL(session.authUrl);
      expect(url.origin).to.equal('https://test.salesforce.com');
      expect(url.searchParams.get('client_id')).to.equal('MyApp');
      expect(url.searchParams.get('scope')).to.equal('api sfap_api');
      expect(session.authUrl).to.not.include('shh');
      expect(session.oauthConfig.clientSecret).to.equal('shh');
    });

    it('creates the OAuth2 instance from the same jsforce copy that @salesforce/core uses', () => {
      // AuthInfo checks `options.oauth2 instanceof OAuth2`; a second jsforce copy would silently drop the PKCE verifier.
      const coreRequire = createRequire(createRequire(import.meta.url).resolve('@salesforce/core'));
      const coreJsforce = coreRequire('@jsforce/jsforce-node') as { OAuth2: typeof OAuth2 };
      expect(coreJsforce.OAuth2).to.equal(OAuth2);
      expect(createManualLoginSession({ loginUrl }, redirectUri).oauth2).to.be.instanceOf(coreJsforce.OAuth2);
    });
  });

  describe('parseCallbackUrl', () => {
    const state = 'a'.repeat(64);
    const expected = { redirectUri, state };
    const good = `${redirectUri}?code=aPrx.abc123%3D%3D&state=${state}`;

    it('returns the decoded authorization code for a valid callback', () => {
      expect(parseCallbackUrl(good, expected)).to.equal('aPrx.abc123==');
    });

    it('tolerates surrounding whitespace and newlines from the clipboard', () => {
      expect(parseCallbackUrl(`  ${good}\n`, expected)).to.equal('aPrx.abc123==');
    });

    it('rejects empty input', () => {
      expectSfError(() => parseCallbackUrl('   ', expected), 'EmptyCallbackUrlError');
    });

    it('rejects malformed URLs', () => {
      for (const bad of ['not a url', 'http://local host:1717/OauthRedirect?code=x', 'code=abc']) {
        expectSfError(() => parseCallbackUrl(bad, expected), 'MalformedCallbackUrlError');
      }
    });

    it('rejects callbacks on an unexpected origin or path', () => {
      for (const bad of [
        `https://localhost:1717/OauthRedirect?code=x&state=${state}`,
        `http://localhost:1718/OauthRedirect?code=x&state=${state}`,
        `http://evil.example/OauthRedirect?code=x&state=${state}`,
        `http://localhost:1717/other?code=x&state=${state}`,
        `http://localhost:1717/OauthRedirect/extra?code=x&state=${state}`,
        `localhost:1717/OauthRedirect?code=x&state=${state}`,
        `https://login.salesforce.com/services/oauth2/authorize?state=${state}`,
      ]) {
        expectSfError(() => parseCallbackUrl(bad, expected), 'UnexpectedRedirectUriError');
      }
    });

    it('rejects a missing or mismatched state before looking at anything else', () => {
      expectSfError(() => parseCallbackUrl(`${redirectUri}?code=x`, expected), 'StateMismatchError');
      expectSfError(
        () => parseCallbackUrl(`${redirectUri}?code=x&state=${'b'.repeat(64)}`, expected),
        'StateMismatchError'
      );
      expectSfError(() => parseCallbackUrl(`${redirectUri}?code=x&state=${state}0`, expected), 'StateMismatchError');
      expectSfError(
        () => parseCallbackUrl(`${redirectUri}?error=access_denied&state=nope`, expected),
        'StateMismatchError'
      );
    });

    it('surfaces OAuth error responses with the description when present', () => {
      const err = expectSfError(
        () =>
          parseCallbackUrl(
            `${redirectUri}?error=access_denied&error_description=end-user+denied+authorization&state=${state}`,
            expected
          ),
        'OAuthError'
      );
      expect(err.message).to.equal('end-user denied authorization');
      const bare = expectSfError(
        () => parseCallbackUrl(`${redirectUri}?error=invalid_scope&state=${state}`, expected),
        'OAuthError'
      );
      expect(bare.message).to.equal('invalid_scope');
    });

    it('strips control characters from error descriptions before they reach the terminal', () => {
      const err = expectSfError(
        () =>
          parseCallbackUrl(
            `${redirectUri}?error=x&error_description=${encodeURIComponent('bad\u001b[2Jtext\r\n')}&state=${state}`,
            expected
          ),
        'OAuthError'
      );
      expect(err.message).to.equal('bad[2Jtext');
    });

    it('rejects a callback without an authorization code', () => {
      expectSfError(() => parseCallbackUrl(`${redirectUri}?state=${state}`, expected), 'MissingAuthCodeError');
      expectSfError(() => parseCallbackUrl(`${redirectUri}?code=&state=${state}`, expected), 'MissingAuthCodeError');
    });
  });
});
