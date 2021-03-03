/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { $$, expect, test } from '@salesforce/command/lib/test';
import { Aliases, AuthInfo, AuthInfoConfig, Authorization } from '@salesforce/core';
import { MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { parseJson } from '../../testHelper';

describe('auth:list', async () => {
  const testData = new MockTestOrgData();
  let authInfoStub: StubbedType<AuthInfo>;
  let authInfoConfigStub: StubbedType<AuthInfoConfig>;

  async function prepareStubs(forceFailure = false) {
    const authFields = await testData.getConfig();
    authInfoStub = stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
      getConnectionOptions: () => ({ accessToken: authFields.accessToken }),
      isJwt: () => true,
      isOauth: () => false,
    });

    $$.SANDBOX.stub(AuthInfo, 'listAllAuthFiles').callsFake(async () => [authFields.username] as string[]);

    if (forceFailure) {
      stubMethod($$.SANDBOX, AuthInfo, 'create').callsFake(async () => {
        throw new Error('decrypt error');
      });
    } else {
      stubMethod($$.SANDBOX, AuthInfo, 'create').callsFake(async () => authInfoStub);
    }

    stubMethod($$.SANDBOX, Aliases.prototype, 'getKeysByValue').returns(['TestAlias']);

    authInfoConfigStub = stubInterface<AuthInfoConfig>($$.SANDBOX, {
      getContents: () => authFields,
    });
    stubMethod($$.SANDBOX, AuthInfoConfig, 'create').callsFake(async () => authInfoConfigStub);
  }

  test
    .do(async () => prepareStubs())
    .stdout()
    .command(['auth:list', '--json'])
    .it('should show auth files', (ctx) => {
      const auths = parseJson<Authorization[]>(ctx.stdout).result;
      expect(auths[0].alias).to.equal('TestAlias');
      expect(auths[0].username).to.equal(testData.username);
      expect(auths[0].instanceUrl).to.equal(testData.instanceUrl);
      expect(auths[0].orgId).to.equal(testData.orgId);
      expect(auths[0].oauthMethod).to.equal('jwt');
    });

  test
    .do(async () => prepareStubs(true))
    .stdout()
    .command(['auth:list', '--json'])
    .it('should show files with auth errors', (ctx) => {
      const auths = parseJson<Authorization[]>(ctx.stdout).result;
      expect(auths[0].alias).to.equal('TestAlias');
      expect(auths[0].username).to.equal(testData.username);
      expect(auths[0].instanceUrl).to.equal(testData.instanceUrl);
      expect(auths[0].orgId).to.equal(testData.orgId);
      expect(auths[0].oauthMethod).to.equal('unknown');
      expect(auths[0].error).to.equal('decrypt error');
    });
});
