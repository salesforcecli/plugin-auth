/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import fs from 'node:fs/promises';
import { AuthFields, AuthInfo } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup.js';
import { expect } from 'chai';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { stubUx } from '@salesforce/sf-plugins-core';
import LoginSfdxUrl from '../../../../src/commands/org/login/sfdx-url.js';

type Options = {
  authInfoCreateFails?: boolean;
  existingAuth?: boolean;
  fileDoesNotExist?: boolean;
};

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

    stubUx($$.SANDBOX);
  }

  it('should return auth fields', async () => {
    await prepareStubs();
    const response = await LoginSfdxUrl.run(['-f', keyPathTxt, '--json']);
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

    const response = await LoginSfdxUrl.run(['-f', keyPathJson, '--json']);
    expect(response.username).to.equal(testData.username);
  });

  it("should error out when it doesn't find a url in a JSON file", async () => {
    await prepareStubs({ fileDoesNotExist: true });
    $$.SANDBOX.stub(fs, 'readFile')
      .callThrough()
      .withArgs(keyPathJson, 'utf8')
      .resolves(
        JSON.stringify({
          notASfdxAuthUrl: 'force://PlatformCLI::CoffeeAndBacon@su0503.my.salesforce.com',
        })
      );

    try {
      const response = await LoginSfdxUrl.run(['-f', keyPathJson, '--json']);
      expect.fail(`Should have thrown an error. Response: ${JSON.stringify(response)}`);
    } catch (e) {
      expect((e as Error).message).to.includes('Error getting the auth URL from file');
    }
  });

  it('should set alias when -a is provided', async () => {
    await prepareStubs();
    await LoginSfdxUrl.run(['-f', keyPathTxt, '-a', 'MyAlias', '--json']);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
  });

  it('should set target-org to alias when -s and -a are provided', async () => {
    await prepareStubs();
    await LoginSfdxUrl.run(['-f', keyPathTxt, '-a', 'MyAlias', '-s', '--json']);
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
    await LoginSfdxUrl.run(['-f', keyPathTxt, '-s', '--json']);
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
    await LoginSfdxUrl.run(['-f', keyPathTxt, '-a', 'MyAlias', '-d', '--json']);
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
    await LoginSfdxUrl.run(['-f', keyPathTxt, '-d', '--json']);
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
    await LoginSfdxUrl.run(['-f', keyPathTxt, '-d', '-s', '--json']);
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
    await LoginSfdxUrl.run(['-f', keyPathTxt, '-d', '-s', '-a', 'MyAlias', '--json']);
    expect(authInfoStub.handleAliasAndDefaultSettings.callCount).to.equal(1);
    expect(authInfoStub.handleAliasAndDefaultSettings.args[0]).to.deep.equal([
      {
        alias: 'MyAlias',
        setDefaultDevHub: true,
        setDefault: true,
      },
    ]);
  });

  it('should error out when neither file or url are provided', async () => {
    await prepareStubs();
    try {
      const response = await LoginSfdxUrl.run([]);
      expect.fail(`Should have thrown an error. Response: ${JSON.stringify(response)}`);
    } catch (e) {
      expect((e as Error).message).to.includes(
        'Exactly one of the following must be provided: --sfdx-url-file, --sfdx-url-stdin'
      );
    }
  });

  it('should return auth fields when using stdin', async () => {
    await prepareStubs();
    const sfdxAuthUrl = 'force://PlatformCLI::CoffeeAndBacon@su0503.my.salesforce.com';
    const flagOutput = {
      flags: {
        'no-prompt': false,
        'sfdx-url-file': '',
        'sfdx-url-stdin': sfdxAuthUrl,
      },
    };
    stubMethod($$.SANDBOX, LoginSfdxUrl.prototype, 'parse').resolves(flagOutput);
    const response = await LoginSfdxUrl.run(['-u', '-']);
    expect(response.username).to.equal(testData.username);
  });
});
