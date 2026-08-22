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

import { AuthFields, SfError } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import type { SinonStub } from 'sinon';
import { expect } from 'chai';
import LoginClientCredentials from '../../../../src/commands/org/login/client-credentials.js';
import AccessToken from '../../../../src/commands/org/login/access-token.js';

type Options = {
  tokenRequestFails?: boolean;
};

describe('org:login:client-credentials', () => {
  const $$ = new TestContext();
  const clientSecret = 'very-secret';
  const instanceUrl = 'https://MyDomainName.my.salesforce.com';
  const authFields = { username: 'jdoe@example.org' } as AuthFields;
  let fetchStub: { callCount: number; firstCall: { args: unknown[] } };
  let accessTokenRunStub: SinonStub;
  let originalClientSecret: string | undefined;
  let originalAccessToken: string | undefined;

  beforeEach(() => {
    originalClientSecret = process.env.SF_CLIENT_SECRET;
    originalAccessToken = process.env.SF_ACCESS_TOKEN;
    process.env.SF_CLIENT_SECRET = clientSecret;
    accessTokenRunStub = $$.SANDBOX.stub(AccessToken.prototype, 'run').resolves(authFields);
  });

  afterEach(() => {
    if (originalClientSecret !== undefined) {
      process.env.SF_CLIENT_SECRET = originalClientSecret;
    } else {
      delete process.env.SF_CLIENT_SECRET;
    }
    if (originalAccessToken !== undefined) {
      process.env.SF_ACCESS_TOKEN = originalAccessToken;
    } else {
      delete process.env.SF_ACCESS_TOKEN;
    }
  });

  const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
    ({
      ok,
      status,
      json: () => Promise.resolve(body),
    } as Response);

  const prepareStubs = (options: Options = {}): void => {
    /* eslint-disable camelcase */
    fetchStub = $$.SANDBOX.stub(globalThis, 'fetch').resolves(
      options.tokenRequestFails
        ? jsonResponse({ error: 'invalid_client', error_description: 'client identifier invalid' }, false, 400)
        : jsonResponse({
            access_token: '00Dxx0000000000!token',
            instance_url: instanceUrl,
          })
    );
    /* eslint-enable camelcase */
  };

  it('should return the access-token login response', async () => {
    prepareStubs();
    const response = await LoginClientCredentials.run(['-i', '123456', '-r', instanceUrl, '--json']);

    expect(response).to.equal(authFields);
    expect(accessTokenRunStub.callCount).to.equal(1);
    expect(process.env.SF_ACCESS_TOKEN).to.be.undefined;
  });

  it('should temporarily replace and then restore an existing access token', async () => {
    const priorAccessToken = 'prior-access-token';
    process.env.SF_ACCESS_TOKEN = priorAccessToken;
    accessTokenRunStub.callsFake(() => {
      expect(process.env.SF_ACCESS_TOKEN).to.equal('00Dxx0000000000!token');
      return Promise.resolve(authFields);
    });
    prepareStubs();

    await LoginClientCredentials.run(['-i', '123456', '-r', instanceUrl, '--json']);

    expect(process.env.SF_ACCESS_TOKEN).to.equal(priorAccessToken);
  });

  it('should omit the short client-id flag before delegating to the access-token command', async () => {
    prepareStubs();
    await LoginClientCredentials.run(['-i', '123456', '-r', instanceUrl, '--set-default', '--json']);

    const delegatedCommand = accessTokenRunStub.firstCall.thisValue as { argv: string[] };
    expect(delegatedCommand.argv).to.deep.equal(['-r', instanceUrl, '--set-default', '--json']);
  });

  it('should omit the long client-id flag before delegating to the access-token command', async () => {
    prepareStubs();
    await LoginClientCredentials.run(['--client-id', '123456', '-r', instanceUrl, '--alias', 'ci-org', '--json']);

    const delegatedCommand = accessTokenRunStub.firstCall.thisValue as { argv: string[] };
    expect(delegatedCommand.argv).to.deep.equal(['-r', instanceUrl, '--alias', 'ci-org', '--json']);
  });

  it('should throw an error when the client secret environment variable is missing', async () => {
    delete process.env.SF_CLIENT_SECRET;
    try {
      await LoginClientCredentials.run(['-i', '123456', '-r', instanceUrl, '--json']);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e).to.be.instanceOf(Error);
      const authError = e as SfError;
      expect(authError.message).to.include('The client secret environment variable was not set');
    }
    expect(accessTokenRunStub.callCount).to.equal(0);
  });

  it('should request a token with client credentials in the POST body, not the URL', async () => {
    prepareStubs();
    await LoginClientCredentials.run(['-i', '123456', '-r', instanceUrl, '--json']);

    expect(fetchStub.callCount).to.equal(1);
    const [url, init] = fetchStub.firstCall.args as [URL, RequestInit];
    expect(url.pathname).to.equal('/services/oauth2/token');
    expect(url.search).to.equal('');
    expect(String(url)).to.not.include(clientSecret);
    expect(init.method).to.equal('POST');
    expect(init.headers).to.deep.equal({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const body = String(init.body);
    expect(body).to.include('grant_type=client_credentials');
    expect(body).to.include('client_id=123456');
    expect(body).to.include(`client_secret=${clientSecret}`);
  });

  it('should wrap token request errors', async () => {
    prepareStubs({ tokenRequestFails: true });
    try {
      await LoginClientCredentials.run(['-i', '123456INVALID', '-r', instanceUrl, '--json']);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e).to.be.instanceOf(Error);
      const authError = e as SfError;
      expect(authError.message).to.include('We encountered a client credentials error');
      expect(authError.message).to.include('client identifier invalid');
      expect(authError.cause, 'ClientCredentialsGrantError should include original error as the cause').to.be.ok;
    }
    expect(accessTokenRunStub.callCount).to.equal(0);
  });
});
