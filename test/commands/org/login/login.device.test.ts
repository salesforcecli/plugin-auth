/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable camelcase */

import { AuthFields, AuthInfo, DeviceOauthService, Global, Mode } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { DeviceCodeResponse } from '@salesforce/core/lib/deviceOauthService';
import { expect } from 'chai';
import { Config } from '@oclif/core';
import { SfCommand } from '@salesforce/sf-plugins-core';
import Login from '../../../../lib/commands/org/login/device';

interface Options {
  approvalTimesout?: boolean;
  approvalFails?: boolean;
}

describe('org:login:device', async () => {
  const $$ = new TestContext();

  const testData = new MockTestOrgData();
  const mockAction: DeviceCodeResponse = {
    device_code: '1234',
    interval: 5000,
    user_code: '1234',
    verification_uri: 'https://login.salesforce.com',
  };

  let authFields: AuthFields;
  let authInfoStub: StubbedType<AuthInfo>;

  async function prepareStubs(options: Options = {}) {
    authFields = await testData.getConfig();
    delete authFields.isDevHub;

    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });

    stubMethod($$.SANDBOX, DeviceOauthService.prototype, 'requestDeviceLogin').returns(Promise.resolve(mockAction));

    if (options.approvalFails) {
      stubMethod($$.SANDBOX, DeviceOauthService.prototype, 'awaitDeviceApproval').returns(Promise.resolve());
    }

    if (options.approvalTimesout) {
      stubMethod($$.SANDBOX, DeviceOauthService.prototype, 'pollForDeviceApproval').throws('polling timeout');
    } else {
      stubMethod($$.SANDBOX, DeviceOauthService.prototype, 'pollForDeviceApproval').callsFake(async () => ({
        access_token: '1234',
        refresh_token: '1234',
        signature: '1234',
        scope: '1234',
        instance_url: 'https://login.salesforce.com',
        id: '1234',
        token_type: '1234',
        issued_at: '1234',
      }));
    }

    stubMethod($$.SANDBOX, AuthInfo, 'create').callsFake(async () => authInfoStub);
    await $$.stubAuths(testData);
  }

  it('should return auth fields', async () => {
    await prepareStubs();
    const login = new Login(['--json'], {} as Config);
    const response = await login.run();
    expect(response.username).to.equal(testData.username);
  });

  it('should return auth fields with instance url', async () => {
    await prepareStubs();
    const login = new Login(['-r', 'https://login.salesforce.com', '--json'], {} as Config);
    const response = await login.run();
    expect(response.username).to.equal(testData.username);
  });

  it('should set alias when -a is provided', async () => {
    await prepareStubs();
    const login = new Login(['-a', 'MyAlias', '--json'], {} as Config);
    const response = await login.run();
    expect(response.username).to.equal(testData.username);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
  });

  it('should set target-org when -s is provided', async () => {
    await prepareStubs();
    const login = new Login(['-s', '--json'], {} as Config);
    const response = await login.run();
    expect(response.username).to.equal(testData.username);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
  });

  it('should set target-dev-hub when -d is provided', async () => {
    await prepareStubs();
    const login = new Login(['-d', '--json'], {} as Config);
    const response = await login.run();
    expect(response.username).to.equal(testData.username);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
  });

  it('show required action in human readable output', async () => {
    await prepareStubs();
    const styledHeaderSpy = $$.SANDBOX.spy(SfCommand.prototype, 'styledHeader');
    const logSpy = $$.SANDBOX.spy(SfCommand.prototype, 'log');
    const login = new Login([], {} as Config);
    await login.run();
    expect(styledHeaderSpy.calledOnce).to.be.true;
    expect(logSpy.callCount).to.be.greaterThan(0);
  });

  it('should gracefully handle approval timeout', async () => {
    await prepareStubs({ approvalTimesout: true });
    const login = new Login(['--json'], {} as Config);
    try {
      const response = await login.run();
      expect.fail(`should have thrown: ${JSON.stringify(response)}`);
    } catch (e) {
      expect((e as Error).name).to.equal('polling timeout');
    }
  });

  it('should gracefully handle failed approval', async () => {
    await prepareStubs({ approvalFails: true });
    const login = new Login(['--json'], {} as Config);
    const response = await login.run();
    expect(response).to.deep.equal({});
  });

  it('should prompt for client secret if client id is provided', async () => {
    await prepareStubs();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    $$.SANDBOX.stub(Login.prototype, 'askForHiddenResponse').returns(Promise.resolve('1234'));
    const login = new Login(['-i', 'CoffeeBeans', '--json'], {} as Config);
    const response = await login.run();
    expect(response.username).to.equal(testData.username);
  });

  it('should prompt for when in demo mode (SFDX_ENV=demo)', async () => {
    await prepareStubs();
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.DEMO);
    $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(true);
    const login = new Login(['--json'], {} as Config);
    const response = await login.run();
    expect(response.username).to.equal(testData.username);
  });

  it('should exit early when prompt is answered NO', async () => {
    await prepareStubs();
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.DEMO);
    $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(false);
    const login = new Login(['--json'], {} as Config);
    const response = await login.run();
    expect(response).to.deep.equal({});
  });
});
