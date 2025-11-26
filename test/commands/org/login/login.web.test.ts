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

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { Config } from '@oclif/core';
import { AuthFields, AuthInfo, SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { assert, expect } from 'chai';
import { Env } from '@salesforce/kit';
import { SfCommand, Ux } from '@salesforce/sf-plugins-core';
import LoginWeb from '../../../../src/commands/org/login/web.js';

describe('org:login:web', () => {
  const $$ = new TestContext();
  const testData = new MockTestOrgData();
  const config = stubInterface<Config>($$.SANDBOX, {
    runHook: async () =>
      Promise.resolve({
        successes: [],
        failures: [],
      }),
  });
  let authFields: AuthFields;
  let authInfoStub: StubbedType<AuthInfo>;
  let uxStub: StubbedType<Ux>;

  async function createNewLoginCommand(
    flags: string[] = [],
    promptAnswer = false,
    clientSecret = ''
  ): Promise<LoginWeb> {
    authFields = await testData.getConfig();
    $$.SANDBOX.stub(SfCommand.prototype, 'secretPrompt').resolves(clientSecret);
    $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(promptAnswer);

    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });

    stubMethod($$.SANDBOX, LoginWeb.prototype, 'executeLoginFlow').resolves(authInfoStub);
    $$.SANDBOX.stub(AuthInfo, 'listAllAuthorizations').resolves([]);

    // @ts-ignore
    const login = new LoginWeb(flags, config);
    // @ts-ignore because protected member
    login.ux = uxStub;
    // @ts-ignore because protected member
    login.flags = Object.assign({}, { noprompt: true }, flags);
    return login;
  }

  async function createNewLoginCommandWithError(errorName: string): Promise<LoginWeb> {
    authFields = await testData.getConfig();
    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });
    stubMethod($$.SANDBOX, LoginWeb.prototype, 'executeLoginFlow').throws(() => new SfError('error!', errorName));
    uxStub = stubInterface<Ux>($$.SANDBOX, {});

    // @ts-ignore
    const login = new LoginWeb([], config);
    // @ts-ignore because protected member
    login.ux = uxStub;
    // @ts-ignore because protected member
    login.flags = { noprompt: true };
    return login;
  }

  it('should return auth fields after successful auth', async () => {
    const login = await createNewLoginCommand([], false, undefined);
    const result = await login.run();
    expect(result).to.deep.equal(authFields);
  });

  it('should set alias', async () => {
    const login = await createNewLoginCommand(['--alias', 'MyAlias'], false, undefined);
    const result = await login.run();
    expect(result).to.deep.equal(authFields);
    expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
      {
        alias: 'MyAlias',
        setDefaultDevHub: undefined,
        setDefault: undefined,
      },
    ]);
  });

  it('should set target-org', async () => {
    const login = await createNewLoginCommand(['--set-default'], false, undefined);
    const result = await login.run();
    expect(result).to.deep.equal(authFields);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
  });

  it('should set target-dev-hub', async () => {
    const login = await createNewLoginCommand(['--set-default-dev-hub'], false, undefined);
    const result = await login.run();
    expect(result).to.deep.equal(authFields);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
  });

  it('should throw headless auth error when in container mode (SFDX_CONTAINER_MODE)', async () => {
    stubMethod($$.SANDBOX, Env.prototype, 'getBoolean').withArgs('SFDX_CONTAINER_MODE').returns(true);
    const login = await createNewLoginCommand([], false, undefined);
    try {
      await login.run();
      assert(false, 'should throw headless auth error');
    } catch (error) {
      const err = error as SfError;
      expect(err.name).to.equal('SfError');
    }
  });
  it('should throw headless auth error when in container mode (SF_CONTAINER_MODE)', async () => {
    stubMethod($$.SANDBOX, Env.prototype, 'getBoolean').withArgs('SF_CONTAINER_MODE').returns(true);
    const login = await createNewLoginCommand([], false, undefined);
    try {
      await login.run();
      assert(false, 'should throw headless auth error');
    } catch (error) {
      const err = error as SfError;
      expect(err.name).to.equal('SfError');
    }
  });

  it('should NOT throw headless auth error for CODE_BUILDER auth', async () => {
    stubMethod($$.SANDBOX, Env.prototype, 'getBoolean').withArgs('CODE_BUILDER').returns(true);
    const login = await createNewLoginCommand([], false, undefined);
    const result = await login.run();
    expect(result).to.deep.equal(authFields);
  });

  it('should prompt for client secret when clientid is present', async () => {
    const login = await createNewLoginCommand(['--client-id', 'CoffeeBeans'], false, undefined);
    await login.run();
  });

  it('should show invalidClientId error if AuthCodeExchangeError', async () => {
    const login = await createNewLoginCommandWithError('AuthCodeExchangeError');
    try {
      await login.run();
      assert(false, 'should throw error');
    } catch (e) {
      const err = e as SfError;
      expect(err.message).to.include('Invalid client credentials');
    }
  });

  it('should show generic error if there is an error', async () => {
    const login = await createNewLoginCommandWithError('SomeOtherError');
    try {
      await login.run();
      assert(false, 'should throw error');
    } catch (e) {
      const err = e as SfError;
      expect(err.message).to.include('error!');
    }
  });

  it('should pass scopes flag to executeLoginFlow when scopes are provided', async () => {
    authFields = await testData.getConfig();
    $$.SANDBOX.stub(SfCommand.prototype, 'secretPrompt').resolves('');
    $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(false);

    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });

    // Create the stub and capture it for verification
    const executeLoginFlowStub = stubMethod($$.SANDBOX, LoginWeb.prototype, 'executeLoginFlow').resolves(authInfoStub);
    $$.SANDBOX.stub(AuthInfo, 'listAllAuthorizations').resolves([]);

    // @ts-ignore
    const login = new LoginWeb(['--scopes', 'api web refresh_token'], config);
    // @ts-ignore because protected member
    login.ux = uxStub;
    // @ts-ignore because protected member
    login.flags = { noprompt: true, scopes: 'api web refresh_token' };

    await login.run();

    // Verify that executeLoginFlow was called with the scopes parameter
    expect(executeLoginFlowStub.callCount).to.equal(1);
    const callArgs = executeLoginFlowStub.getCall(0).args;
    expect(callArgs[2]).to.equal('api web refresh_token'); // scopes should be the 3rd argument
  });

  it('should pass undefined scopes to executeLoginFlow when scopes flag is not provided', async () => {
    authFields = await testData.getConfig();
    $$.SANDBOX.stub(SfCommand.prototype, 'secretPrompt').resolves('');
    $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(false);

    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });

    // Create the stub and capture it for verification
    const executeLoginFlowStub = stubMethod($$.SANDBOX, LoginWeb.prototype, 'executeLoginFlow').resolves(authInfoStub);
    $$.SANDBOX.stub(AuthInfo, 'listAllAuthorizations').resolves([]);

    // @ts-ignore
    const login = new LoginWeb([], config);
    // @ts-ignore because protected member
    login.ux = uxStub;
    // @ts-ignore because protected member
    login.flags = { noprompt: true };

    await login.run();

    // Verify that executeLoginFlow was called without scopes (undefined)
    expect(executeLoginFlowStub.callCount).to.equal(1);
    const callArgs = executeLoginFlowStub.getCall(0).args;
    expect(callArgs[2]).to.be.undefined; // scopes should be undefined when not provided
  });

  it('should pass scopes flag to executeLoginFlow when linking client-app with scopes', async () => {
    authFields = await testData.getConfig();
    $$.SANDBOX.stub(SfCommand.prototype, 'secretPrompt').resolves('client-secret');
    $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(false);

    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });

    // Create the stub and capture it for verification
    const executeLoginFlowStub = stubMethod($$.SANDBOX, LoginWeb.prototype, 'executeLoginFlow').resolves(authInfoStub);
    // @ts-ignore
    $$.SANDBOX.stub(AuthInfo, 'create').resolves(authInfoStub);
    $$.SANDBOX.stub(AuthInfo, 'listAllAuthorizations').resolves([]);

    // @ts-ignore
    const login = new LoginWeb(['--client-app', 'MyApp', '--username', 'test@example.com', '--scopes', 'api web'], config);
    // @ts-ignore because protected member
    login.ux = uxStub;
    // @ts-ignore because protected member
    login.flags = {
      noprompt: true,
      'client-app': 'MyApp',
      username: 'test@example.com',
      scopes: 'api web',
    };

    await login.run();

    // Verify that executeLoginFlow was called with the correct parameters
    expect(executeLoginFlowStub.callCount).to.equal(1);
    const callArgs = executeLoginFlowStub.getCall(0).args;
    expect(callArgs[2]).to.equal('MyApp'); // client-app should be the 3rd argument
    expect(callArgs[3]).to.equal('test@example.com'); // username should be the 4th argument
    expect(callArgs[4]).to.equal('api web'); // scopes should be the 5th argument
  });

  it('should pass undefined scopes to executeLoginFlow when linking client-app without scopes', async () => {
    authFields = await testData.getConfig();
    $$.SANDBOX.stub(SfCommand.prototype, 'secretPrompt').resolves('client-secret');
    $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(false);

    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });

    // Create the stub and capture it for verification
    const executeLoginFlowStub = stubMethod($$.SANDBOX, LoginWeb.prototype, 'executeLoginFlow').resolves(authInfoStub);
    // @ts-ignore
    $$.SANDBOX.stub(AuthInfo, 'create').resolves(authInfoStub);
    $$.SANDBOX.stub(AuthInfo, 'listAllAuthorizations').resolves([]);

    // @ts-ignore
    const login = new LoginWeb(['--client-app', 'MyApp', '--username', 'test@example.com'], config);
    // @ts-ignore because protected member
    login.ux = uxStub;
    // @ts-ignore because protected member
    login.flags = {
      noprompt: true,
      'client-app': 'MyApp',
      username: 'test@example.com',
    };

    await login.run();

    // Verify that executeLoginFlow was called with the correct parameters
    expect(executeLoginFlowStub.callCount).to.equal(1);
    const callArgs = executeLoginFlowStub.getCall(0).args;
    expect(callArgs[2]).to.equal('MyApp'); // client-app should be the 3rd argument
    expect(callArgs[3]).to.equal('test@example.com'); // username should be the 4th argument
    expect(callArgs[4]).to.be.undefined; // scopes should be undefined when not provided
  });
});
