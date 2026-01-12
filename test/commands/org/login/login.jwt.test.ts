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
import LoginJwt from '../../../../src/commands/org/login/jwt.js';

type Options = {
  authInfoCreateFails?: boolean;
  existingAuth?: boolean;
};

describe('org:login:jwt', () => {
  const $$ = new TestContext();

  const testData = new MockTestOrgData();
  let authFields: AuthFields;
  let authInfoStub: StubbedType<AuthInfo>;

  async function prepareStubs(options: Options = {}): Promise<void> {
    authFields = await testData.getConfig();
    delete authFields.isDevHub;

    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });

    await $$.stubAuths(testData);

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
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      $$.SANDBOX.stub(AuthInfo, 'create').resolves(authInfoStub);
    }

    stubUx($$.SANDBOX);
  }

  it('should return auth fields', async () => {
    await prepareStubs();
    const response = await LoginJwt.run(['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '--json']);
    expect(response.username).to.equal(testData.username);
  });

  it('should set alias when -a is provided', async () => {
    await prepareStubs();
    await LoginJwt.run(['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-a', 'MyAlias', '--json']);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
  });

  it('should set target-org to alias when -s and -a are provided', async () => {
    await prepareStubs();
    await LoginJwt.run([
      '-u',
      testData.username,
      '-f',
      'path/to/key.json',
      '-i',
      '123456',
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
    await LoginJwt.run(['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-s', '--json']);
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
    await LoginJwt.run([
      '-u',
      testData.username,
      '-f',
      'path/to/key.json',
      '-i',
      '123456',
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
    await LoginJwt.run(['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-d', '--json']);
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
    await LoginJwt.run(['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-d', '-s', '--json']);
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
    await LoginJwt.run([
      '-u',
      testData.username,
      '-f',
      'path/to/key.json',
      '-i',
      '123456',
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
    await prepareStubs({ authInfoCreateFails: true });
    try {
      await LoginJwt.run(['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456INVALID', '--json']);
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e).to.be.instanceOf(Error);
      const jwtAuthError = e as SfError;
      expect(jwtAuthError.message).to.include('We encountered a JSON web token error');
      expect(jwtAuthError.message).to.include('invalid client id');
      expect(jwtAuthError.cause, 'JwtAuthErrors should include original error as the cause').to.be.ok;
    }
  });

  it('should not throw an error when the authorization already exists', async () => {
    await prepareStubs({ existingAuth: true });
    try {
      await LoginJwt.run(['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '--json']);
    } catch (e) {
      expect.fail('Should not have thrown an error');
    }
  });
});
