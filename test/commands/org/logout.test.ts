/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover, ConfigContents, Global, Mode } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup.js';
import { expect } from 'chai';
import { Config } from '@oclif/core';
import { SfCommand } from '@salesforce/sf-plugins-core';
import Logout from '../../../src/commands/org/logout.js';

interface Options {
  authFiles?: string[];
  'target-org'?: string;
  'target-dev-hub'?: string;
  aliases?: {
    [key: string]: string;
  };
  authInfoConfigFails?: boolean;
  authInfoConfigDoesNotExist?: boolean;
}

describe('org:logout', () => {
  const $$ = new TestContext();
  const testOrg1 = new MockTestOrgData();
  const testOrg2 = new MockTestOrgData();
  const testOrg3 = new MockTestOrgData();

  let authRemoverSpy: sinon.SinonSpy;

  async function prepareStubs(options: Options = {}): Promise<ConfigContents> {
    const authInfo = await testOrg1.getConfig();

    authRemoverSpy = $$.SANDBOX.spy(AuthRemover.prototype, 'removeAuth');

    if (!options.authInfoConfigDoesNotExist) {
      await $$.stubAuths(testOrg1, testOrg2, testOrg3);
    }

    if (options['target-org']) {
      $$.setConfigStubContents('Config', { contents: { 'target-org': options['target-org'] } });
    }

    if (options.aliases) {
      $$.stubAliases(options.aliases);
    }
    return authInfo;
  }

  it('should throw error when both -a and -o are specified', async () => {
    await prepareStubs();
    const logout = new Logout(['-a', '-o', testOrg1.username, '--json'], {} as Config);
    try {
      await logout.run();
    } catch (e) {
      const error = e as Error;
      expect(error.name).to.equal('Error');
      expect(error.message).to.include('cannot also be provided when using --all');
    }
  });

  it('should remove target-org when neither -a nor -o are specified', async () => {
    await prepareStubs({ 'target-org': testOrg1.username });
    const logout = new Logout(['-p', '--json'], {} as Config);
    const response = await logout.run();

    expect(response).to.deep.equal([testOrg1.username]);
    expect(authRemoverSpy.callCount).to.equal(1);
  });

  it('should remove username specified by -o', async () => {
    await prepareStubs({ 'target-org': testOrg1.username });
    const logout = new Logout(['-p', '-o', testOrg1.username, '--json'], {} as Config);
    const response = await logout.run();
    expect(response).to.deep.equal([testOrg1.username]);
    expect(authRemoverSpy.callCount).to.equal(1);
  });

  it('should remove all usernames when -a is specified', async () => {
    await prepareStubs();
    const logout = new Logout(['-p', '-a', '--json'], {} as Config);
    const response = await logout.run();
    expect(response).to.deep.equal([testOrg1.username, testOrg2.username, testOrg3.username]);
    expect(authRemoverSpy.callCount).to.equal(3);
  });

  it('should remove all usernames when in demo mode', async () => {
    await prepareStubs();
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.DEMO);
    const logout = new Logout(['-p', '-a', '--json'], {} as Config);
    const response = await logout.run();
    expect(response).to.deep.equal([testOrg1.username, testOrg2.username, testOrg3.username]);
    expect(authRemoverSpy.callCount).to.equal(3);
  });

  it('should throw error if no target-org', async () => {
    await prepareStubs();
    const logout = new Logout(['-p', '--json'], {} as Config);
    try {
      const response = await logout.run();
      expect.fail(`should have thrown error. Response: ${JSON.stringify(response)}`);
    } catch (e) {
      expect((e as Error).name).to.equal('NoOrgSpecifiedWithNoPromptError');
      expect(authRemoverSpy.callCount).to.equal(0);
    }
  });

  it('should do nothing when prompt is answered with no', async () => {
    await prepareStubs();
    $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(false);
    const logout = new Logout(['-o', testOrg1.username], {} as Config);
    const response = await logout.run();
    expect(response).to.deep.equal([]);
  });

  it('should remove auth when alias is specified', async () => {
    await prepareStubs({ aliases: { TestAlias: testOrg1.username } });
    const logout = new Logout(['-p', '-o', 'TestAlias', '--json'], {} as Config);
    const response = await logout.run();
    expect(response).to.deep.equal([testOrg1.username]);
  });

  it('should remove auth when target-org and target-dev-hub have same alias', async () => {
    await prepareStubs({
      'target-org': 'TestAlias',
      'target-dev-hub': 'TestAlias',
      aliases: { TestAlias: testOrg1.username },
    });
    const logout = new Logout(['-p', '--json'], {} as Config);
    const response = await logout.run();
    expect(response).to.deep.equal([testOrg1.username]);
  });

  it('should remove auth when target-org is alias', async () => {
    await prepareStubs({
      'target-org': 'TestAlias',
      aliases: { TestAlias: testOrg1.username },
    });
    const logout = new Logout(['-p', '--json'], {} as Config);
    const response = await logout.run();
    expect(response).to.deep.equal([testOrg1.username]);
  });

  it('should not fail when the auth file does not exist', async () => {
    await prepareStubs({
      'target-org': testOrg2.username,
      aliases: { TestAlias: testOrg1.username },
      authInfoConfigDoesNotExist: true,
    });
    const logout = new Logout(['-p', '-o', testOrg1.username, '--json'], {} as Config);
    const response = await logout.run();
    expect(response).to.deep.equal([testOrg1.username]);
  });
});
