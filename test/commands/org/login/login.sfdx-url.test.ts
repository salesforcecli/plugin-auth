/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs/promises';
import { AuthFields, AuthInfo, Global, Mode } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { expect, assert } from 'chai';
import { Config } from '@oclif/core';
import { StubbedType, stubInterface } from '@salesforce/ts-sinon';
import { SfCommand } from '@salesforce/sf-plugins-core';
import LoginSfdxUrl from '../../../../src/commands/org/login/sfdx-url';
import * as stdin from '../../../../src/stdin';

interface Options {
  authInfoCreateFails?: boolean;
  existingAuth?: boolean;
  fileDoesNotExist?: boolean;
}

describe('org:login:sfdx-url', () => {
  const $$ = new TestContext();
  const testData = new MockTestOrgData();
  let authFields: AuthFields;
  let authInfoStub: StubbedType<AuthInfo>;
  const keyPathTxt = 'path/to/key.txt';
  const keyPathJson = 'path/to/key.json';

  async function prepareStubs(options: Options = {}): Promise<void> {
    authFields = await testData.getConfig();
    $$.stubAliases({});
    delete authFields.isDevHub;

    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
    });

    await $$.stubAuths(testData);

    if (!options.fileDoesNotExist) {
      $$.SANDBOX.stub(fs, 'readFile')
        .callThrough()
        .withArgs(keyPathTxt, 'utf8')
        .resolves('force://PlatformCLI::CoffeeAndBacon@su0503.my.salesforce.com');
    }

    if (options.authInfoCreateFails) {
      $$.SANDBOX.stub(AuthInfo, 'create').throws(new Error('invalid client id'));
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      $$.SANDBOX.stub(AuthInfo, 'create').resolves(authInfoStub);
    }
  }

  it('should return auth fields', async () => {
    await prepareStubs();
    const store = new LoginSfdxUrl(['-f', keyPathTxt, '--json'], {} as Config);
    const response = await store.run();
    expect(response.username).to.equal(testData.username);
  });

  it('should return auth fields when passing in a json file', async () => {
    await prepareStubs({ fileDoesNotExist: true });
    $$.SANDBOX.stub(fs, 'readFile')
      .callThrough()
      .withArgs(keyPathJson, 'utf8')
      .resolves(
        JSON.stringify({
          sfdxAuthUrl: 'force://PlatformCLI::CoffeeAndBacon@su0503.my.salesforce.com',
        })
      );

    const store = new LoginSfdxUrl(['-f', keyPathJson, '--json'], {} as Config);
    const response = await store.run();
    expect(response.username).to.equal(testData.username);
  });

  it("should error out when it doesn't find a url in a JSON file", async () => {
    await prepareStubs({ fileDoesNotExist: true });
    $$.SANDBOX.stub(fs, 'readFile').resolves(
      JSON.stringify({
        notASfdxAuthUrl: 'force://PlatformCLI::CoffeeAndBacon@su0503.my.salesforce.com',
      })
    );

    const store = new LoginSfdxUrl(['-f', keyPathJson, '--json'], {} as Config);
    try {
      const response = await store.run();
      expect.fail(`Should have thrown an error. Response: ${JSON.stringify(response)}`);
    } catch (e) {
      expect((e as Error).message).to.includes('Error retrieving the auth URL');
    }
  });

  it('should set alias when -a is provided', async () => {
    await prepareStubs();
    const store = new LoginSfdxUrl(['-f', keyPathTxt, '-a', 'MyAlias', '--json'], {} as Config);
    await store.run();
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
  });

  it('should set target-org to alias when -s and -a are provided', async () => {
    await prepareStubs();
    const store = new LoginSfdxUrl(['-f', keyPathTxt, '-a', 'MyAlias', '-s', '--json'], {} as Config);
    await store.run();
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
    const store = new LoginSfdxUrl(['-f', keyPathTxt, '-s', '--json'], {} as Config);
    await store.run();
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

  it('should set target-dev-hub to alias when -d and -a are provided', async () => {
    await prepareStubs();
    const store = new LoginSfdxUrl(['-f', keyPathTxt, '-a', 'MyAlias', '-d', '--json'], {} as Config);
    await store.run();
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
    const store = new LoginSfdxUrl(['-f', keyPathTxt, '-d', '--json'], {} as Config);
    await store.run();
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
    const store = new LoginSfdxUrl(['-f', keyPathTxt, '-d', '-s', '--json'], {} as Config);
    await store.run();
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
    const store = new LoginSfdxUrl(['-f', keyPathTxt, '-d', '-s', '-a', 'MyAlias', '--json'], {} as Config);
    await store.run();
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
    expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
      {
        alias: 'MyAlias',
        setDefaultDevHub: true,
        setDefault: true,
      },
    ]);
  });

  it('should auth when in demo mode (SFDX_ENV=demo) and prompt is answered with yes', async () => {
    await prepareStubs();
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.DEMO);
    $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(true);
    const store = new LoginSfdxUrl(['-f', keyPathTxt, '--json'], {} as Config);
    await store.run();
    expect(authInfoStub.save.callCount).to.equal(1);
  });

  it('should do nothing when in demo mode (SFDX_ENV=demo) and prompt is answered with no', async () => {
    await prepareStubs();
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.DEMO);
    $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(false);
    const store = new LoginSfdxUrl(['-f', keyPathTxt, '--json'], {} as Config);
    await store.run();
    expect(authInfoStub.save.callCount).to.equal(0);
  });

  it('should ignore prompt when in demo mode (SFDX_ENV=demo) and -p is provided', async () => {
    await prepareStubs();
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.DEMO);
    $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(false);
    const store = new LoginSfdxUrl(['-p', '-f', keyPathTxt, '--json'], {} as Config);
    await store.run();
    expect(authInfoStub.save.callCount).to.equal(1);
  });

  it('should return auth fields when reading auth url from stdin', async () => {
    await prepareStubs({ fileDoesNotExist: true });
    $$.SANDBOX.stub(stdin, 'read').resolves('force://PlatformCLI::CoffeeAndBacon@su0503.my.salesforce.com');
    const store = new LoginSfdxUrl(['--sfdx-url-stdin', '--json'], {} as Config);
    const response = await store.run();
    expect(response.username).to.equal(testData.username);
  });

  it('should throw error when piping empty string to stdin', async () => {
    await prepareStubs({ fileDoesNotExist: true });
    $$.SANDBOX.stub(stdin, 'read').resolves('');
    const store = new LoginSfdxUrl(['--sfdx-url-stdin', '--json'], {} as Config);

    try {
      const response = await store.run();
      expect.fail(`Should have thrown an error. Response: ${JSON.stringify(response)}`);
    } catch (e) {
      expect((e as Error).message).to.includes('Error retrieving the auth URL');
    }
  });

  it('should throw error when not piping anything to stdin', async () => {
    await prepareStubs({ fileDoesNotExist: true });
    $$.SANDBOX.stub(stdin, 'read').resolves(undefined);
    const store = new LoginSfdxUrl(['--sfdx-url-stdin', '--json'], {} as Config);

    try {
      const response = await store.run();
      expect.fail(`Should have thrown an error. Response: ${JSON.stringify(response)}`);
    } catch (e) {
      expect((e as Error).message).to.includes('Error retrieving the auth URL');
    }
  });

  it('should ignore stdin when not using --sfdx-url-stdin', async () => {
    await prepareStubs();
    $$.SANDBOX.stub(stdin, 'read').resolves('force://foo::bar@su0503.my.salesforce.com');
    const parseSfdxAuthUrlSpy = $$.SANDBOX.spy(AuthInfo, 'parseSfdxAuthUrl');
    const store = new LoginSfdxUrl(['-f', keyPathTxt, '--json'], {} as Config);
    await store.run();

    assert.isTrue(parseSfdxAuthUrlSpy.calledWith('force://PlatformCLI::CoffeeAndBacon@su0503.my.salesforce.com'));
  });

  it('should throw error when passing both sfdx-url-stdin and sfdx-url-file', async () => {
    const store = new LoginSfdxUrl(['--sfdx-url-stdin', '--sfdx-url-file', 'path/to/key.txt', '--json'], {} as Config);

    try {
      const response = await store.run();
      expect.fail(`Should have thrown an error. Response: ${JSON.stringify(response)}`);
    } catch (e) {
      expect((e as Error).message).to.includes('--sfdx-url-file cannot also be provided when using --sfdx-url-stdin');
    }
  });

  it('should throw error when not passing sfdx-url-stdin and sfdx-url-file', async () => {
    const store = new LoginSfdxUrl(['--json'], {} as Config);

    try {
      const response = await store.run();
      expect.fail(`Should have thrown an error. Response: ${JSON.stringify(response)}`);
    } catch (e) {
      expect((e as Error).message).to.includes('Exactly one of the following must be provided: --sfdx-url-file');
      expect((e as Error).message).to.includes('Exactly one of the following must be provided: --sfdx-url-stdin');
    }
  });
});
