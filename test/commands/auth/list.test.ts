/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { Config } from '@oclif/core';
import { expect } from 'chai';
import { AuthInfo } from '@salesforce/core';
import List from '../../../src/commands/auth/list';

describe('auth:list', async () => {
  const $$ = new TestContext();
  const testData = new MockTestOrgData();
  testData.aliases = ['TestAlias'];

  async function prepareStubs(forceFailure = false) {
    await $$.stubAuths(testData);
    $$.stubAliases({ TestAlias: testData.username });
    if (forceFailure) {
      $$.SANDBOX.stub(AuthInfo, 'create').throws(new Error('decrypt error'));
    }
  }

  it('should show auth files', async () => {
    await prepareStubs();
    const list = new List(['--json'], {} as Config);
    const auths = await list.run();
    expect(auths[0].alias).to.deep.equal(testData.aliases?.join(',') ?? '');
    expect(auths[0].username).to.equal(testData.username);
    expect(auths[0].instanceUrl).to.equal(testData.instanceUrl);
    expect(auths[0].orgId).to.equal(testData.orgId);
    expect(auths[0].oauthMethod).to.equal('web');
  });

  it('should show files with auth errors', async () => {
    await prepareStubs(true);
    const list = new List(['--json'], {} as Config);
    const auths = await list.run();
    expect(auths[0].alias).to.deep.equal(testData.aliases?.join(',') ?? '');
    expect(auths[0].username).to.equal(testData.username);
    expect(auths[0].instanceUrl).to.equal(testData.instanceUrl);
    expect(auths[0].orgId).to.equal(testData.orgId);
    expect(auths[0].oauthMethod).to.equal('unknown');
    expect(auths[0].error).to.equal('decrypt error');
  });
});
