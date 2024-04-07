/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthFields, AuthInfo, SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup.js';
import { StubbedType, stubInterface } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { Config } from '@oclif/core';
import LoginJwt from '../../../../src/commands/org/login/jwt.js';

type Options = {
  authInfoCreateFails?: boolean;
  existingAuth?: boolean;
}

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
  }

  it('should return auth fields', async () => {
    await prepareStubs();
    const grant = new LoginJwt(
      ['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '--json'],
      {} as Config
    );
    const response = await grant.run();
    expect(response.username).to.equal(testData.username);
  });

  it('should set alias when -a is provided', async () => {
    await prepareStubs();
    const grant = new LoginJwt(
      ['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-a', 'MyAlias', '--json'],
      {} as Config
    );
    await grant.run();
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
  });

  it('should set target-org to alias when -s and -a are provided', async () => {
    await prepareStubs();
    const grant = new LoginJwt(
      ['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-a', 'MyAlias', '-s', '--json'],
      {} as Config
    );
    await grant.run();
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
    const grant = new LoginJwt(
      ['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-s', '--json'],
      {} as Config
    );
    await grant.run();
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
    const grant = new LoginJwt(
      ['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-a', 'MyAlias', '-d', '--json'],
      {} as Config
    );
    await grant.run();
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
    const grant = new LoginJwt(
      ['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-d', '--json'],
      {} as Config
    );
    await grant.run();
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
    const grant = new LoginJwt(
      ['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-d', '-s', '--json'],
      {} as Config
    );
    await grant.run();
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
    const grant = new LoginJwt(
      ['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '-d', '-s', '-a', 'MyAlias', '--json'],
      {} as Config
    );
    await grant.run();
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
    const grant = new LoginJwt(
      ['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456INVALID', '--json'],
      {} as Config
    );
    try {
      await grant.run();
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect((e as Error).message).to.include('We encountered a JSON web token error');
    }
  });

  it('should not throw an error when the authorization already exists', async () => {
    await prepareStubs({ existingAuth: true });
    const grant = new LoginJwt(
      ['-u', testData.username, '-f', 'path/to/key.json', '-i', '123456', '--json'],
      {} as Config
    );
    try {
      await grant.run();
    } catch (e) {
      expect.fail('Should not have thrown an error');
    }
  });
});
