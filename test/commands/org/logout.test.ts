/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover, ConfigContents, Global, Mode, Messages } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubPrompter, stubUx } from '@salesforce/sf-plugins-core';
import Logout from '../../../src/commands/org/logout.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'logout');

type Options = {
  authFiles?: string[];
  'target-org'?: string;
  'target-dev-hub'?: string;
  aliases?: {
    [key: string]: string;
  };
  authInfoConfigFails?: boolean;
  authInfoConfigDoesNotExist?: boolean;
};

describe('org:logout', () => {
  const $$ = new TestContext();
  const testOrg1 = new MockTestOrgData();
  const testOrg2 = new MockTestOrgData();
  const testOrg3 = new MockTestOrgData();
  let promptStub: ReturnType<typeof stubPrompter>;
  let authRemoverSpy: sinon.SinonSpy;

  async function prepareStubs(options: Options = {}): Promise<ConfigContents> {
    const authInfo = await testOrg1.getConfig();
    promptStub = stubPrompter($$.SANDBOX);
    authRemoverSpy = $$.SANDBOX.spy(AuthRemover.prototype, 'removeAuth');

    if (!options.authInfoConfigDoesNotExist) {
      await $$.stubAuths(testOrg1, testOrg2, testOrg3);
    }

    if (options['target-org']) {
      $$.setConfigStubContents('Config', { contents: { 'target-org': options['target-org'] } });
    } else {
      $$.setConfigStubContents('Config', { contents: {} });
    }

    if (options.aliases) {
      $$.stubAliases(options.aliases);
    }

    stubUx($$.SANDBOX);

    return authInfo;
  }

  it('should throw error when both -a and -o are specified', async () => {
    await prepareStubs();
    try {
      await Logout.run(['-a', '-o', testOrg1.username, '--json']);
    } catch (e) {
      const error = e as Error;
      expect(error.name).to.equal('Error');
      expect(error.message).to.include('cannot also be provided when using --all');
    }
  });

  it('should remove target-org when neither -a nor -o are specified', async () => {
    await prepareStubs({ 'target-org': testOrg1.username });
    const response = await Logout.run(['-p', '--json']);

    expect(response).to.deep.equal([testOrg1.username]);
    expect(authRemoverSpy.callCount).to.equal(1);
  });

  it('should remove username specified by -o', async () => {
    await prepareStubs({ 'target-org': testOrg1.username });
    const response = await Logout.run(['-p', '-o', testOrg1.username, '--json']);
    expect(response).to.deep.equal([testOrg1.username]);
    expect(authRemoverSpy.callCount).to.equal(1);
  });

  it('should remove all usernames when -a is specified', async () => {
    await prepareStubs();
    const response = await Logout.run(['-p', '-a', '--json']);
    expect(response).to.deep.equal([testOrg1.username, testOrg2.username, testOrg3.username]);
    expect(authRemoverSpy.callCount).to.equal(3);
  });

  it('should remove all usernames when in demo mode', async () => {
    await prepareStubs();
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.DEMO);
    const response = await Logout.run(['-p', '-a', '--json']);
    expect(response).to.deep.equal([testOrg1.username, testOrg2.username, testOrg3.username]);
    expect(authRemoverSpy.callCount).to.equal(3);
  });

  it('should throw error if no target-org', async () => {
    await prepareStubs();
    try {
      const response = await Logout.run(['-p', '--json']);
      expect.fail(`should have thrown error. Response: ${JSON.stringify(response)}`);
    } catch (e) {
      expect((e as Error).name).to.equal('NoOrgSpecifiedWithNoPromptError');
      expect(authRemoverSpy.callCount).to.equal(0);
    }
  });

  describe('prompts', () => {
    it('shows correct prompt for single org', async () => {
      await prepareStubs();
      promptStub.confirm.resolves(false);
      await Logout.run(['-o', testOrg1.username]);
      expect(promptStub.confirm.args[0][0].message).to.equal(
        messages.getMessage('prompt.confirm.single', [testOrg1.username])
      );
    });
    it('should do nothing when prompt is answered with no', async () => {
      await prepareStubs();
      promptStub.confirm.resolves(false);
      const response = await Logout.run(['-o', testOrg1.username]);
      expect(response).to.deep.equal([]);
    });
  });

  it('should remove auth when alias is specified', async () => {
    await prepareStubs({ aliases: { TestAlias: testOrg1.username } });
    const response = await Logout.run(['-p', '-o', 'TestAlias', '--json']);
    expect(response).to.deep.equal([testOrg1.username]);
  });

  it('should remove auth when target-org and target-dev-hub have same alias', async () => {
    await prepareStubs({
      'target-org': 'TestAlias',
      'target-dev-hub': 'TestAlias',
      aliases: { TestAlias: testOrg1.username },
    });
    const response = await Logout.run(['-p', '--json']);
    expect(response).to.deep.equal([testOrg1.username]);
  });

  it('should remove auth when target-org is alias', async () => {
    await prepareStubs({
      'target-org': 'TestAlias',
      aliases: { TestAlias: testOrg1.username },
    });
    const response = await Logout.run(['-p', '--json']);
    expect(response).to.deep.equal([testOrg1.username]);
  });

  it('should not fail when the auth file does not exist', async () => {
    await prepareStubs({
      'target-org': testOrg2.username,
      aliases: { TestAlias: testOrg1.username },
      authInfoConfigDoesNotExist: true,
    });
    const response = await Logout.run(['-p', '-o', testOrg1.username, '--json']);
    expect(response).to.deep.equal([testOrg1.username]);
  });
});
