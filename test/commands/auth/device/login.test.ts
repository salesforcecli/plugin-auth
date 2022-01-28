/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable camelcase */

import { $$, expect, test } from '@salesforce/command/lib/test';
import { AuthFields, AuthInfo } from '@salesforce/core';
import { MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { DeviceOauthService } from '@salesforce/core';
import { DeviceCodeResponse } from '@salesforce/core/lib/deviceOauthService';
import { UX } from '@salesforce/command';
import { SinonStub } from 'sinon';
import { OrgAuthorization } from '@salesforce/core/lib/org/authInfo';
import { parseJson } from '../../../testHelper';

interface Options {
  approvalTimesout?: boolean;
  approvalFails?: boolean;
}

interface Action {
  device_code: string;
  interval: number;
  user_code: string;
  verification_uri: string;
}

interface Response {
  status: number;
  result: Record<string, unknown>;
}

function parseJsonResponse(str: string): [Action, Response] {
  return str.split('}\n{').map((p) => {
    if (p.startsWith('{')) {
      return JSON.parse(`${p}}`) as Action;
    } else {
      return JSON.parse(`{${p}`) as Response;
    }
  }) as [Action, Response];
}

describe('auth:device:login', async () => {
  const testData = new MockTestOrgData();
  const mockAction: DeviceCodeResponse = {
    device_code: '1234',
    interval: 5000,
    user_code: '1234',
    verification_uri: 'https://login.salesforce.com',
  };

  let authFields: AuthFields;
  let authInfoStub: StubbedType<AuthInfo>;
  let uxStub: SinonStub;

  async function prepareStubs(options: Options = {}) {
    authFields = await testData.getConfig();
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
      stubMethod($$.SANDBOX, DeviceOauthService.prototype, 'pollForDeviceApproval').callsFake(async () => {
        return {
          access_token: '1234',
          refresh_token: '1234',
          signature: '1234',
          scope: '1234',
          instance_url: 'https://login.salesforce.com',
          id: '1234',
          token_type: '1234',
          issued_at: '1234',
        };
      });
    }

    stubMethod($$.SANDBOX, AuthInfo, 'create').callsFake(async () => authInfoStub);
    $$.SANDBOX.stub(AuthInfo, 'listAllAuthorizations').callsFake(
      async (orgAuthFilter?: (orgAuth: OrgAuthorization) => boolean) => {
        return [{ username: authFields.username }] as OrgAuthorization[];
      }
    );
  }

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:device:login', '--json'])
    .it('should return auth fields', (ctx) => {
      const [action, response] = parseJsonResponse(ctx.stdout);
      expect(action).to.deep.equal(mockAction);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(response.result.username).to.equal(testData.username);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:device:login', '-r', 'https://login.salesforce.com', '--json'])
    .it('should return auth fields with instance url', (ctx) => {
      const [action, response] = parseJsonResponse(ctx.stdout);
      expect(action).to.deep.equal(mockAction);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(response.result.username).to.equal(testData.username);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:device:login', '-a', 'MyAlias', '--json'])
    .it('should set alias when -a is provided', (ctx) => {
      const [action, response] = parseJsonResponse(ctx.stdout);
      expect(action).to.deep.equal(mockAction);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(response.result.username).to.equal(testData.username);
      expect(authInfoStub.setAlias.callCount).to.equal(1);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:device:login', '-s', '--json'])
    .it('should set defaultusername when -s is provided', (ctx) => {
      const [action, response] = parseJsonResponse(ctx.stdout);
      expect(action).to.deep.equal(mockAction);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(response.result.username).to.equal(testData.username);
      expect(authInfoStub.setAsDefault.callCount).to.equal(1);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:device:login', '-d', '--json'])
    .it('should set defaultdevhubusername when -d is provided', (ctx) => {
      const [action, response] = parseJsonResponse(ctx.stdout);
      expect(action).to.deep.equal(mockAction);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(response.result.username).to.equal(testData.username);
      expect(authInfoStub.setAsDefault.callCount).to.equal(1);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:device:login'])
    .it('show required action in human readable output', (ctx) => {
      expect(ctx.stdout).include('Action Required!');
      expect(ctx.stdout).include(mockAction.device_code);
      expect(ctx.stdout).include(mockAction.verification_uri);
    });

  test
    .do(async () => prepareStubs({ approvalTimesout: true }))
    .stdout()
    .command(['auth:device:login', '--json'])
    .it('should gracefully handle approval timeout', (ctx) => {
      const [action, response] = parseJsonResponse(ctx.stdout);
      expect(action).to.deep.equal(mockAction);
      expect(response.status).to.equal(1);
    });

  test
    .do(async () => prepareStubs({ approvalFails: true }))
    .stdout()
    .command(['auth:device:login', '--json'])
    .it('should gracefully handle failed approval', (ctx) => {
      const [action, response] = parseJsonResponse(ctx.stdout);
      expect(action).to.deep.equal(mockAction);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal({});
    });

  test
    .do(async () => {
      await prepareStubs();
      uxStub = stubMethod($$.SANDBOX, UX.prototype, 'prompt').returns(Promise.resolve('1234'));
    })
    .stdout()
    .command(['auth:device:login', '-i', 'CoffeeBeans', '--json'])
    .it('should prompt for client secret if client id is provided', (ctx) => {
      const [action, response] = parseJsonResponse(ctx.stdout);
      expect(uxStub.callCount).to.equal(1);
      expect(action).to.deep.equal(mockAction);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(response.result.username).to.equal(testData.username);
    });

  test
    .do(async () => {
      await prepareStubs();
      process.env['SFDX_ENV'] = 'demo';
      uxStub = stubMethod($$.SANDBOX, UX.prototype, 'prompt').returns(Promise.resolve('yes'));
    })
    .finally(() => {
      delete process.env['SFDX_ENV'];
    })
    .stdout()
    .command(['auth:device:login', '--json'])
    .it('should prompt for when in demo mode (SFDX_ENV=demo)', (ctx) => {
      const [action, response] = parseJsonResponse(ctx.stdout);
      expect(uxStub.callCount).to.equal(1);
      expect(action).to.deep.equal(mockAction);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(response.result.username).to.equal(testData.username);
    });

  test
    .do(async () => {
      await prepareStubs();
      process.env['SFDX_ENV'] = 'demo';
      uxStub = stubMethod($$.SANDBOX, UX.prototype, 'prompt').returns(Promise.resolve('NO'));
    })
    .finally(() => {
      delete process.env['SFDX_ENV'];
    })
    .stdout()
    .command(['auth:device:login', '--json'])
    .it('should exit early when prompt is answered NO', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(uxStub.callCount).to.equal(1);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal({});
    });
});
