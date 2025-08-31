/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
