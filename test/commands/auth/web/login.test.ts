/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { $$, expect } from '@salesforce/command/lib/test';
import { IConfig } from '@oclif/config';
import { AuthFields, AuthInfo, Mode, Global, SfdxError } from '@salesforce/core';
import { MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { UX } from '@salesforce/command';
import { Env } from '@salesforce/kit';
import { assert } from 'chai';
import Login from '../../../../src/commands/auth/web/login';

describe('auth:web:login', () => {
  const testData = new MockTestOrgData();
  const config = stubInterface<IConfig>($$.SANDBOX, {});
  let authFields: AuthFields;
  let authInfoStub: StubbedType<AuthInfo>;
  let uxStub: StubbedType<UX>;

  async function createNewLoginCommand(
    flags: Record<string, string | boolean> = {},
    promptAnswer = 'NO'
  ): Promise<Login> {
    authFields = await testData.getConfig();
    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });
    stubMethod($$.SANDBOX, Login.prototype, 'executeLoginFlow').callsFake(async () => {
      return authInfoStub;
    });
    uxStub = stubInterface<UX>($$.SANDBOX, {
      prompt: () => promptAnswer,
    });

    const login = new Login([], config);
    // @ts-ignore because protected memeber
    login.ux = uxStub;
    // @ts-ignore because protected memeber
    login.flags = Object.assign({}, { noprompt: true }, flags);
    return login;
  }

  async function createNewLoginCommandWithError(errorName: string): Promise<Login> {
    authFields = await testData.getConfig();
    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });
    stubMethod($$.SANDBOX, Login.prototype, 'executeLoginFlow').throws(() => {
      return new SfdxError('error!', errorName);
    });
    uxStub = stubInterface<UX>($$.SANDBOX, {});

    const login = new Login([], config);
    // @ts-ignore because protected memeber
    login.ux = uxStub;
    // @ts-ignore because protected memeber
    login.flags = { noprompt: true };
    return login;
  }

  it('should return auth fields after successful auth', async () => {
    const login = await createNewLoginCommand();
    const result = await login.run();
    expect(result).to.deep.equal(authFields);
  });

  it('should set alias', async () => {
    const login = await createNewLoginCommand({ setalias: 'MyAlias' });
    const result = await login.run();
    expect(result).to.deep.equal(authFields);
    expect(authInfoStub.setAlias.args[0]).to.deep.equal(['MyAlias']);
  });

  it('should set defaultusername', async () => {
    const login = await createNewLoginCommand({ setdefaultusername: true });
    const result = await login.run();
    expect(result).to.deep.equal(authFields);
    expect(authInfoStub.setAsDefault.callCount).to.equal(1);
  });

  it('should set defaultdevhubusername', async () => {
    const login = await createNewLoginCommand({ setdefaultdevhubusername: true });
    const result = await login.run();
    expect(result).to.deep.equal(authFields);
    expect(authInfoStub.setAsDefault.callCount).to.equal(1);
  });

  it('should set the instanceurl', async () => {
    const login = await createNewLoginCommand({ instanceurl: 'https://gs0-dev-hub.my.salesforce.com' });
    const result = await login.run();
    expect(result).to.deep.equal(authFields);
  });

  it('should fail when instanceurl contains a lightning domain', async () => {
    const login = await createNewLoginCommand({ instanceurl: 'https://devhub.lightning.force.com' });
    try {
      await login.run();
    } catch (error) {
      const err = error as SfdxError;
      expect(err.name).to.equal('URL_WARNING');
    }
  });

  it('should throw device warning error when in container mode (SFDX_CONTAINER_MODE)', async () => {
    stubMethod($$.SANDBOX, Env.prototype, 'getBoolean').withArgs('SFDX_CONTAINER_MODE').returns(true);
    const login = await createNewLoginCommand();
    try {
      await login.run();
    } catch (error) {
      const err = error as SfdxError;
      expect(err.name).to.equal('DEVICE_WARNING');
    }
  });

  it('should prompt for client secret when clientid is present', async () => {
    const login = await createNewLoginCommand({ clientid: 'CoffeeBeans' });
    await login.run();
    expect(uxStub.prompt.callCount).to.equal(1);
  });

  it('should exit command if in demo and prompt is answered NO', async () => {
    stubMethod($$.SANDBOX, Global, 'getEnvironmentMode').returns(Mode.DEMO);
    const login = await createNewLoginCommand({ noprompt: false });
    const result = await login.run();
    expect(uxStub.prompt.callCount).to.equal(1);
    expect(result).to.deep.equal({});
  });

  it('should execute command if in demo and prompt is answered YES', async () => {
    stubMethod($$.SANDBOX, Global, 'getEnvironmentMode').returns(Mode.DEMO);
    const login = await createNewLoginCommand({ noprompt: false }, 'YES');
    const result = await login.run();
    expect(uxStub.prompt.callCount).to.equal(1);
    expect(result).to.deep.equal(authFields);
  });

  it('should show invalidClientId error if AuthCodeExchangeError', async () => {
    const login = await createNewLoginCommandWithError('AuthCodeExchangeError');
    try {
      await login.run();
      assert(false, 'should throw error');
    } catch (e) {
      const err = e as SfdxError;
      expect(err.message).to.include('Invalid client credentials');
    }
  });

  it('should show generic error if there is an error', async () => {
    const login = await createNewLoginCommandWithError('SomeOtherError');
    try {
      await login.run();
      assert(false, 'should throw error');
    } catch (e) {
      const err = e as SfdxError;
      expect(err.message).to.include('error!');
    }
  });
});
