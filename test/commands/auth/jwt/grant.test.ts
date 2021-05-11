/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { $$, expect, test } from '@salesforce/command/lib/test';
import { AuthFields, AuthInfo, SfdxError } from '@salesforce/core';
import { MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { UX } from '@salesforce/command';
import { parseJson, parseJsonError } from '../../../testHelper';

interface Options {
  authInfoCreateFails?: boolean;
  existingAuth?: boolean;
}

describe('auth:jwt:grant', async () => {
  const testData = new MockTestOrgData();
  let authFields: AuthFields;
  let authInfoStub: StubbedType<AuthInfo>;

  async function prepareStubs(options: Options = {}) {
    authFields = await testData.getConfig();
    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });
    stubMethod($$.SANDBOX, AuthInfo, 'hasAuthentications').resolves(true);

    if (options.authInfoCreateFails) {
      $$.SANDBOX.stub(AuthInfo, 'create').throws(new Error('invalid client id'));
    } else if (options.existingAuth) {
      stubMethod($$.SANDBOX, AuthInfo, 'create')
        .onFirstCall()
        .throws(new SfdxError('auth exists', 'AuthInfoOverwriteError'))
        .onSecondCall()
        .callsFake(async () => authInfoStub);

      $$.SANDBOX.stub(AuthInfo, 'listAllAuthFiles').callsFake(async () => {
        return [`${authFields.username}.json`];
      });
    } else {
      stubMethod($$.SANDBOX, AuthInfo, 'create').callsFake(async () => authInfoStub);
    }
  }

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:jwt:grant', '-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '--json'])
    .it('should return auth fields', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command([
      'auth:jwt:grant',
      '-u',
      testData.username,
      '-f',
      'path/to/key.json',
      '-i',
      '123456',
      '-a',
      'MyAlias',
      '--json',
    ])
    .it('should set alias when -a is provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.setAlias.callCount).to.equal(1);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command([
      'auth:jwt:grant',
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
    ])
    .it('should set defaultusername to alias when -s and -a are provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.setAlias.args[0]).to.deep.equal(['MyAlias']);
      expect(authInfoStub.setAsDefault.callCount).to.equal(1);
      expect(authInfoStub.setAsDefault.args[0]).to.deep.equal([
        {
          defaultDevhubUsername: undefined,
          defaultUsername: true,
        },
      ]);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:jwt:grant', '-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-s', '--json'])
    .it('should set defaultusername to username when -s is provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.setAlias.callCount).to.equal(0);
      expect(authInfoStub.setAsDefault.callCount).to.equal(1);
      expect(authInfoStub.setAsDefault.args[0]).to.deep.equal([
        {
          defaultDevhubUsername: undefined,
          defaultUsername: true,
        },
      ]);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command([
      'auth:jwt:grant',
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
    ])
    .it('should set defaultdevhubusername to alias when -d and -a are provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.setAlias.args[0]).to.deep.equal(['MyAlias']);
      expect(authInfoStub.setAsDefault.callCount).to.equal(1);
      expect(authInfoStub.setAsDefault.args[0]).to.deep.equal([
        {
          defaultDevhubUsername: true,
          defaultUsername: undefined,
        },
      ]);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:jwt:grant', '-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-d', '--json'])
    .it('should set defaultdevhubusername to username when -d is provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.setAlias.callCount).to.equal(0);
      expect(authInfoStub.setAsDefault.callCount).to.equal(1);
      expect(authInfoStub.setAsDefault.args[0]).to.deep.equal([
        {
          defaultDevhubUsername: true,
          defaultUsername: undefined,
        },
      ]);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command([
      'auth:jwt:grant',
      '-u',
      testData.username,
      '-f',
      'path/to/key.json',
      '-i',
      '123456',
      '-d',
      '-s',
      '--json',
    ])
    .it('should set defaultusername and defaultdevhubusername to username when -d and -s are provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.setAlias.callCount).to.equal(0);
      expect(authInfoStub.setAsDefault.callCount).to.equal(1);
      expect(authInfoStub.setAsDefault.args[0]).to.deep.equal([
        {
          defaultDevhubUsername: true,
          defaultUsername: true,
        },
      ]);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command([
      'auth:jwt:grant',
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
    ])
    .it('should set defaultusername and defaultdevhubusername to alias when -a, -d, and -s are provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.setAlias.args[0]).to.deep.equal(['MyAlias']);
      expect(authInfoStub.setAsDefault.callCount).to.equal(1);
      expect(authInfoStub.setAsDefault.args[0]).to.deep.equal([
        {
          defaultDevhubUsername: true,
          defaultUsername: true,
        },
      ]);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:jwt:grant', '-u', testData.username, '-f', 'path/to/key.json', '--json'])
    .it('should throw an error when client id (-i) is not provided', (ctx) => {
      const response = parseJsonError(ctx.stdout);
      expect(response.status).to.equal(1);
      expect(response.message).to.include('Missing required flag');
    });

  test
    .do(async () => prepareStubs({ authInfoCreateFails: true }))
    .stdout()
    .command(['auth:jwt:grant', '-u', testData.username, '-f', 'path/to/key.json', '-i', '123456INVALID', '--json'])
    .it('should throw an error when client id is invalid', (ctx) => {
      const response = parseJsonError(ctx.stdout);
      expect(response.status).to.equal(1);
      expect(response.message).to.include('We encountered a JSON web token error');
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:jwt:grant', '-u', testData.username, '-i', '123456', '--json'])
    .it('should throw an error when private key file (-f) is not provided', (ctx) => {
      const response = parseJsonError(ctx.stdout);
      expect(response.status).to.equal(1);
      expect(response.message).to.include('Missing required flag');
    });

  test
    .do(async () => prepareStubs({ existingAuth: true }))
    .stdout()
    .command(['auth:jwt:grant', '-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '--json'])
    .it('should not throw an error when the authorization already exists', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
    });

  test
    .do(async () => {
      await prepareStubs();
      process.env['SFDX_ENV'] = 'demo';
      $$.SANDBOX.stub(UX.prototype, 'prompt').returns(Promise.resolve('yes'));
    })
    .finally(() => {
      delete process.env['SFDX_ENV'];
    })
    .stdout()
    .command(['auth:jwt:grant', '-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '--json'])
    .it('should auth when in demo mode (SFDX_ENV=demo) and prompt is answered with yes', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.save.callCount).to.equal(1);
    });

  test
    .do(async () => {
      await prepareStubs();
      process.env['SFDX_ENV'] = 'demo';
      $$.SANDBOX.stub(UX.prototype, 'prompt').returns(Promise.resolve('no'));
    })
    .finally(() => {
      delete process.env['SFDX_ENV'];
    })
    .stdout()
    .command(['auth:jwt:grant', '-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '--json'])
    .it('should do nothing when in demo mode (SFDX_ENV=demo) and prompt is answered with no', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal({});
      expect(authInfoStub.save.callCount).to.equal(0);
    });

  test
    .do(async () => {
      await prepareStubs();
      process.env['SFDX_ENV'] = 'demo';
    })
    .finally(() => {
      delete process.env['SFDX_ENV'];
    })
    .stdout()
    .command(['auth:jwt:grant', '-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '--json', '-p'])
    .it('should ignore prompt when in demo mode (SFDX_ENV=demo) and -p is provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.save.callCount).to.equal(1);
    });
});
