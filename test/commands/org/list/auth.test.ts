/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { AuthInfo } from '@salesforce/core';
import { stubUx } from '@salesforce/sf-plugins-core';
import ListAuth from '../../../../src/commands/org/list/auth.js';

describe('org:list:auth', () => {
  const $$ = new TestContext();
  const testData = new MockTestOrgData();
  testData.aliases = ['TestAlias'];

  async function prepareStubs(forceFailure = false): Promise<void> {
    await $$.stubAuths(testData);
    $$.stubAliases({ TestAlias: testData.username });
    if (forceFailure) {
      $$.SANDBOX.stub(AuthInfo, 'create').throws(new Error('decrypt error'));
    }
    stubUx($$.SANDBOX);
  }

  it('should show auth files', async () => {
    await prepareStubs();
    const [auths] = await ListAuth.run(['--json']);
    expect(auths.alias).to.deep.equal(testData.aliases?.join(',') ?? '');
    expect(auths.username).to.equal(testData.username);
    expect(auths.instanceUrl).to.equal(testData.instanceUrl);
    expect(auths.orgId).to.equal(testData.orgId);
    expect(auths.oauthMethod).to.equal('web');
  });

  it('should show files with auth errors', async () => {
    await prepareStubs(true);
    const [auths] = await ListAuth.run(['--json']);
    expect(auths.alias).to.deep.equal(testData.aliases?.join(',') ?? '');
    expect(auths.username).to.equal(testData.username);
    expect(auths.instanceUrl).to.equal(testData.instanceUrl);
    expect(auths.orgId).to.equal(testData.orgId);
    expect(auths.oauthMethod).to.equal('unknown');
    expect(auths.error).to.equal('decrypt error');
  });
});
