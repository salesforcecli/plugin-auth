/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs/promises';
import { $$, expect, test } from '@salesforce/command/lib/test';
import { AuthFields, AuthInfo, OrgAuthorization } from '@salesforce/core';
import { MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { UX } from '@salesforce/command';
import * as fse from 'fs-extra';
import { parseJson, parseJsonError } from '../../../testHelper';

interface Options {
  authInfoCreateFails?: boolean;
  existingAuth?: boolean;
  fileDoesNotExist?: boolean;
}

describe('auth:sfdxurl:store', async () => {
  const testData = new MockTestOrgData();
  let authFields: AuthFields;
  let authInfoStub: StubbedType<AuthInfo>;

  async function prepareStubs(options: Options = {}) {
    authFields = await testData.getConfig();
    delete authFields.isDevHub;
    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });

    $$.SANDBOX.stub(AuthInfo, 'listAllAuthorizations').callsFake(async () => {
      return [{ [authFields.username]: {} }] as OrgAuthorization[];
    });

    if (!options.fileDoesNotExist) {
      $$.SANDBOX.stub(fs, 'readFile').resolves('force://PlatformCLI::CoffeeAndBacon@su0503.my.salesforce.com');
    }

    if (options.authInfoCreateFails) {
      $$.SANDBOX.stub(AuthInfo, 'create').throws(new Error('invalid client id'));
    } else if (options.existingAuth) {
      stubMethod($$.SANDBOX, AuthInfo, 'create').callsFake(async () => authInfoStub);
    } else {
      stubMethod($$.SANDBOX, AuthInfo, 'create').callsFake(async () => authInfoStub);
    }
  }

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.txt', '--json'])
    .it('should return auth fields', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(response.result.username).to.equal(testData.username);
    });

  test
    .do(async () => {
      await prepareStubs({ fileDoesNotExist: true });
      $$.SANDBOX.stub(fse, 'readJson').callsFake(async () => ({
        sfdxAuthUrl: 'force://PlatformCLI::CoffeeAndBacon@su0503.my.salesforce.com',
      }));
    })
    .stdout()
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.json', '--json'])
    .it('should return auth fields when passing in a json file', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(response.result.username).to.equal(testData.username);
    });

  test
    .do(async () => {
      await prepareStubs({ fileDoesNotExist: true });
      $$.SANDBOX.stub(fse, 'readJson').callsFake(async () => ({
        result: { sfdxAuthUrl: 'force://PlatformCLI::CoffeeAndBacon@su0503.my.salesforce.com' },
      }));
    })
    .stdout()
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.json', '--json'])
    .it(
      'should return auth fields when passing in a json result a la `sfdx force:org:display --verbose --json`',
      (ctx) => {
        const response = parseJson<AuthFields>(ctx.stdout);
        expect(response.status).to.equal(0);
        expect(response.result).to.deep.equal(authFields);
        expect(response.result.username).to.equal(testData.username);
      }
    );

  test
    .do(async () => {
      await prepareStubs({ fileDoesNotExist: true });
      $$.SANDBOX.stub(fse, 'readJson').callsFake(async () => ({
        result: { notASfdxAuthUrl: 'force://PlatformCLI::CoffeeAndBacon@su0503.my.salesforce.com' },
      }));
    })
    .stdout()
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.json', '--json'])
    .it("should error out when it doesn't find a url in a JSON file", (ctx) => {
      const response = parseJsonError(ctx.stdout);
      expect(response.status).to.equal(1);
      // eslint-disable-next-line no-console
      expect(response.message).to.equal(
        'Error getting the auth URL from file path/to/key.json. Please ensure it meets the description shown in the documentation for this command.'
      );
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.txt', '-a', 'MyAlias', '--json'])
    .it('should set alias when -a is provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.txt', '-a', 'MyAlias', '-s', '--json'])
    .it('should set defaultusername to alias when -s and -a are provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
      expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
        {
          alias: 'MyAlias',
          setDefaultDevHub: undefined,
          setDefault: true,
        },
      ]);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.txt', '-s', '--json'])
    .it('should set defaultusername to username when -s is provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.setAlias.callCount).to.equal(0);
      expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
      expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
        {
          alias: undefined,
          setDefaultDevHub: undefined,
          setDefault: true,
        },
      ]);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.txt', '-a', 'MyAlias', '-d', '--json'])
    .it('should set defaultdevhubusername to alias when -d and -a are provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
      expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
        {
          alias: 'MyAlias',
          setDefaultDevHub: true,
          setDefault: undefined,
        },
      ]);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.txt', '-d', '--json'])
    .it('should set defaultdevhubusername to username when -d is provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
      expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
        {
          alias: undefined,
          setDefaultDevHub: true,
          setDefault: undefined,
        },
      ]);
    });
  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.txt', '-d', '-s', '--json'])
    .it('should set defaultusername and defaultdevhubusername to username when -d and -s are provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
      expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
        {
          alias: undefined,
          setDefaultDevHub: true,
          setDefault: true,
        },
      ]);
    });

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.txt', '-d', '-s', '-a', 'MyAlias', '--json'])
    .it('should set defaultusername and defaultdevhubusername to alias when -a, -d, and -s are provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
      expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
        {
          alias: 'MyAlias',
          setDefaultDevHub: true,
          setDefault: true,
        },
      ]);
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
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.txt', '--json'])
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
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.txt', '--json'])
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
    .command(['auth:sfdxurl:store', '-f', 'path/to/key.txt', '--json', '-p'])
    .it('should ignore prompt when in demo mode (SFDX_ENV=demo) and -p is provided', (ctx) => {
      const response = parseJson<AuthFields>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal(authFields);
      expect(authInfoStub.save.callCount).to.equal(1);
    });
});
