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

import { AuthFields, AuthInfo, SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { StubbedType, stubInterface } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { stubUx } from '@salesforce/sf-plugins-core';
import LoginClientCredentials from '../../../../src/commands/org/login/client-credentials.js';

type Options = {
  authInfoCreateFails?: boolean;
  existingAuth?: boolean;
  tokenRequestFails?: boolean;
};

describe('org:login:client-credentials', () => {
  const $$ = new TestContext();

  const testData = new MockTestOrgData();
  const clientSecret = 'very-secret';
  const instanceUrl = 'https://MyDomainName.my.salesforce.com';
  let authFields: AuthFields;
  let authInfoStub: StubbedType<AuthInfo>;
  let fetchStub: { callCount: number; firstCall: { args: unknown[] } };

  const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
    ({
      ok,
      status,
      json: () => Promise.resolve(body),
    } as Response);

  async function prepareStubs(options: Options = {}): Promise<void> {
    authFields = await testData.getConfig();
    delete authFields.isDevHub;

    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });

    await $$.stubAuths(testData);

    /* eslint-disable camelcase */
    if (options.tokenRequestFails) {
      fetchStub = $$.SANDBOX.stub(globalThis, 'fetch').resolves(
        jsonResponse({ error: 'invalid_client', error_description: 'client identifier invalid' }, false, 400)
      );
    } else {
      fetchStub = $$.SANDBOX.stub(globalThis, 'fetch').resolves(
        jsonResponse({
          access_token: '00Dxx0000000000!token',
          instance_url: instanceUrl,
        })
      );
    }
    /* eslint-enable camelcase */

    if (options.authInfoCreateFails) {
      $$.SANDBOX.stub(AuthInfo, 'create').throws(new Error('invalid client id'));
    } else if (options.existingAuth) {
      $$.SANDBOX.stub(AuthInfo, 'create')
        .onFirstCall()
        .throws(new SfError('auth exists', 'AuthInfoOverwriteError'))
        .onSecondCall()
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .resolves(authInfoStub);
    } else if (!options.tokenRequestFails) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      $$.SANDBOX.stub(AuthInfo, 'create').resolves(authInfoStub);
    }

    stubUx($$.SANDBOX);
  }

  it('should return auth fields', async () => {
    await prepareStubs();
    const response = await LoginClientCredentials.run([
      '-o',
      testData.username,
      '--client-secret',
      clientSecret,
      '-i',
      '123456',
      '-r',
      instanceUrl,
      '--json',
    ]);
    expect(response.username).to.equal(testData.username);
  });

  it('should request a token with client credentials in the POST body, not the URL', async () => {
    await prepareStubs();
    await LoginClientCredentials.run([
      '-o',
      testData.username,
      '--client-secret',
      clientSecret,
      '-i',
      '123456',
      '-r',
      instanceUrl,
      '--json',
    ]);
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

  it('should set alias when -a is provided', async () => {
    await prepareStubs();
    await LoginClientCredentials.run([
      '-o',
      testData.username,
      '--client-secret',
      clientSecret,
      '-i',
      '123456',
      '-r',
      instanceUrl,
      '-a',
      'MyAlias',
      '--json',
    ]);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
  });

  it('should set target-org to alias when -s and -a are provided', async () => {
    await prepareStubs();
    await LoginClientCredentials.run([
      '-o',
      testData.username,
      '--client-secret',
      clientSecret,
      '-i',
      '123456',
      '-r',
      instanceUrl,
      '-a',
      'MyAlias',
      '-s',
      '--json',
    ]);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
    expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
      {
        alias: 'MyAlias',
        setDefaultDevHub: undefined,
        setDefault: true,
      },
    ]);
  });

  it('should set target-org to username when -s is provided', async () => {
    await prepareStubs();
    await LoginClientCredentials.run([
      '-o',
      testData.username,
      '--client-secret',
      clientSecret,
      '-i',
      '123456',
      '-r',
      instanceUrl,
      '-s',
      '--json',
    ]);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
    expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
      {
        alias: undefined,
        setDefaultDevHub: undefined,
        setDefault: true,
      },
    ]);
  });

  it('should set target-dev-hub to alias when -d and -a are provided', async () => {
    await prepareStubs();
    await LoginClientCredentials.run([
      '-o',
      testData.username,
      '--client-secret',
      clientSecret,
      '-i',
      '123456',
      '-r',
      instanceUrl,
      '-a',
      'MyAlias',
      '-d',
      '--json',
    ]);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
    expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
      {
        alias: 'MyAlias',
        setDefaultDevHub: true,
        setDefault: undefined,
      },
    ]);
  });

  it('should set target-dev-hub to username when -d is provided', async () => {
    await prepareStubs();
    await LoginClientCredentials.run([
      '-o',
      testData.username,
      '--client-secret',
      clientSecret,
      '-i',
      '123456',
      '-r',
      instanceUrl,
      '-d',
      '--json',
    ]);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
    expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
      {
        alias: undefined,
        setDefaultDevHub: true,
        setDefault: undefined,
      },
    ]);
  });

  it('should set target-org and target-dev-hub to username when -d and -s are provided', async () => {
    await prepareStubs();
    await LoginClientCredentials.run([
      '-o',
      testData.username,
      '--client-secret',
      clientSecret,
      '-i',
      '123456',
      '-r',
      instanceUrl,
      '-d',
      '-s',
      '--json',
    ]);
    expect(authInfoStub.setAlias.callCount).to.equal(0);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
    expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
      {
        alias: undefined,
        setDefaultDevHub: true,
        setDefault: true,
      },
    ]);
  });

  it('should set target-org and target-dev-hub to alias when -a, -d, and -s are provided', async () => {
    await prepareStubs();
    await LoginClientCredentials.run([
      '-o',
      testData.username,
      '--client-secret',
      clientSecret,
      '-i',
      '123456',
      '-r',
      instanceUrl,
      '-d',
      '-s',
      '-a',
      'MyAlias',
      '--json',
    ]);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
    expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
      {
        alias: 'MyAlias',
        setDefaultDevHub: true,
        setDefault: true,
      },
    ]);
  });

  it('should throw an error when client id is invalid', async () => {
    await prepareStubs({ tokenRequestFails: true });
    try {
      await LoginClientCredentials.run([
        '-o',
        testData.username,
        '--client-secret',
        clientSecret,
        '-i',
        '123456INVALID',
        '-r',
        instanceUrl,
        '--json',
      ]);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e).to.be.instanceOf(Error);
      const authError = e as SfError;
      expect(authError.message).to.include('We encountered a client credentials error');
      expect(authError.message).to.include('client identifier invalid');
      expect(authError.cause, 'ClientCredentialsGrantError should include original error as the cause').to.be.ok;
    }
  });

  it('should throw an error when AuthInfo.create fails', async () => {
    await prepareStubs({ authInfoCreateFails: true });
    try {
      await LoginClientCredentials.run([
        '-o',
        testData.username,
        '--client-secret',
        clientSecret,
        '-i',
        '123456',
        '-r',
        instanceUrl,
        '--json',
      ]);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e).to.be.instanceOf(Error);
      const authError = e as SfError;
      expect(authError.message).to.include('We encountered a client credentials error');
      expect(authError.message).to.include('invalid client id');
      expect(authError.cause, 'ClientCredentialsGrantError should include original error as the cause').to.be.ok;
    }
  });

  it('should not throw an error when the authorization already exists', async () => {
    await prepareStubs({ existingAuth: true });
    try {
      await LoginClientCredentials.run([
        '-o',
        testData.username,
        '--client-secret',
        clientSecret,
        '-i',
        '123456',
        '-r',
        instanceUrl,
        '--json',
      ]);
    } catch (e) {
      expect.fail('Should not have thrown an error');
    }
  });

  it('should throw an error when the instance URL is not HTTPS', async () => {
    await prepareStubs();
    try {
      await LoginClientCredentials.run([
        '-o',
        testData.username,
        '--client-secret',
        clientSecret,
        '-i',
        '123456',
        '-r',
        'http://MyDomainName.my.salesforce.com',
        '--json',
      ]);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e).to.be.instanceOf(Error);
      const authError = e as SfError;
      expect(authError.message).to.include('We encountered a client credentials error');
      expect(authError.message).to.include('requires an HTTPS instance URL');
    }
  });
});
