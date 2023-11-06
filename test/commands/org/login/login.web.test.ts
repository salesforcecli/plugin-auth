/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { Config } from '@oclif/core';
import { AuthFields, AuthInfo, Global, Mode, SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup.js';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { assert, expect } from 'chai';
import { Env } from '@salesforce/kit';
import { SfCommand, Ux } from '@salesforce/sf-plugins-core';
import LoginWeb from '../../../../src/commands/org/login/web.js';

describe('org:login:web', () => {
  const $$ = new TestContext();
  const testData = new MockTestOrgData();
  const config = stubInterface<Config>($$.SANDBOX, {});
  let authFields: AuthFields;
  let authInfoStub: StubbedType<AuthInfo>;
  let uxStub: StubbedType<Ux>;

  async function createNewLoginCommand(
    flags: string[] = [],
    promptAnswer = false,
    clientSecret = ''
  ): Promise<LoginWeb> {
    authFields = await testData.getConfig();
    // @ts-ignore
    $$.SANDBOX.stub(LoginWeb.prototype, 'askForClientSecret').resolves(clientSecret);
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

  it('should throw device warning error when in container mode (SFDX_CONTAINER_MODE)', async () => {
    stubMethod($$.SANDBOX, Env.prototype, 'getBoolean').withArgs('SFDX_CONTAINER_MODE').returns(true);
    const login = await createNewLoginCommand([], false, undefined);
    try {
      await login.run();
    } catch (error) {
      const err = error as SfError;
      expect(err.name).to.equal('DEVICE_WARNING');
    }
  });

  it('should prompt for client secret when clientid is present', async () => {
    const login = await createNewLoginCommand(['--client-id', 'CoffeeBeans'], false, undefined);
    await login.run();
  });

  it('should exit command if in demo and prompt is answered NO', async () => {
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.DEMO);
    const login = await createNewLoginCommand([], false, undefined);
    const result = await login.run();
    expect(result).to.deep.equal({});
  });

  it('should execute command if in demo and prompt is answered YES', async () => {
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.DEMO);
    const login = await createNewLoginCommand([], true, undefined);
    const result = await login.run();
    expect(result).to.deep.equal(authFields);
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
});
