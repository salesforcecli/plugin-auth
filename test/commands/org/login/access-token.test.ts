/*
 * Copyright 2026, Salesforce, Inc.
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

import { AuthFields, AuthInfo, StateAggregator } from '@salesforce/core';
import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import { stubPrompter, stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { env } from '@salesforce/kit';
import Store from '../../../../src/commands/org/login/access-token.js';

describe('org:login:access-token', () => {
  const $$ = new TestContext();
  const accessToken = '00Dxx0000000000!xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  const authFields = {
    accessToken,
    instanceUrl: 'https://foo.bar.org.salesforce.com',
    loginUrl: 'https://foo.bar.org.salesforce.com',
    orgId: '00D000000000000',
    username: 'foo@baz.org',
  } as const satisfies AuthFields;

  /* eslint-disable camelcase */
  const userInfo = {
    preferred_username: 'foo@baz.org',
    organization_id: '00D000000000000',
    custom_domain: 'https://foo.bar.org.salesforce.com',
  };
  /* eslint-enable camelcase */
  let stubSfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;
  let prompterStubs: ReturnType<typeof stubPrompter>;

  beforeEach(() => {
    // @ts-expect-error because private method
    $$.SANDBOX.stub(Store.prototype, 'saveAuthInfo').resolves(userInfo);
    $$.SANDBOX.stub(AuthInfo.prototype, 'getUsername').returns(authFields.username);
    $$.SANDBOX.stub(AuthInfo.prototype, 'getFields').returns({
      accessToken,
      orgId: authFields.orgId,
      instanceUrl: authFields.instanceUrl,
      loginUrl: authFields.loginUrl,
      username: authFields.username,
    });
    // @ts-expect-error because private method
    $$.SANDBOX.stub(Store.prototype, 'getUserInfo').resolves(AuthInfo.prototype);
    stubSfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
    prompterStubs = stubPrompter($$.SANDBOX);
  });

  it('should return auth fields after successful auth', async () => {
    prompterStubs.secret.resolves(accessToken);

    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(prompterStubs.secret.callCount).to.equal(1);
    expect(stubSfCommandUxStubs.logSuccess.callCount).to.equal(1);
    expect(result).to.deep.equal(authFields);
  });

  it('should show that auth file already exists', async () => {
    prompterStubs.secret.resolves(accessToken);
    prompterStubs.confirm.resolves(false);
    $$.SANDBOX.stub(StateAggregator, 'getInstance').resolves({
      // @ts-expect-error because incomplete interface
      orgs: {
        exists: () => Promise.resolve(true),
      },
    });
    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(result).to.deep.equal(authFields);
    expect(prompterStubs.secret.callCount).to.equal(1);
    expect(prompterStubs.confirm.callCount).to.equal(1);
  });

  it('should show that auth file does not already exist', async () => {
    prompterStubs.secret.resolves(accessToken);
    $$.SANDBOX.stub(StateAggregator, 'getInstance').resolves({
      // @ts-expect-error because incomplete interface
      orgs: {
        exists: () => Promise.resolve(false),
      },
    });
    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(result).to.deep.equal(authFields);
    expect(prompterStubs.confirm.callCount).to.equal(0);
  });

  it('should use env var SF_ACCESS_TOKEN as input to the store command', async () => {
    $$.SANDBOX.stub(env, 'getString')
      .withArgs('SF_ACCESS_TOKEN')
      .returns(accessToken)
      .withArgs('SFDX_ACCESS_TOKEN')
      // @ts-expect-error not sure why TS thinks a string is required.  getString can return undefined
      .returns(undefined);

    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(result).to.deep.equal(authFields);
    // no prompts needed when using Env
    expect(prompterStubs.confirm.callCount).to.equal(0);
    expect(prompterStubs.secret.callCount).to.equal(0);
  });

  it('should use env var SFDX_ACCESS_TOKEN as input to the store command', async () => {
    $$.SANDBOX.stub(env, 'getString')
      .withArgs('SFDX_ACCESS_TOKEN')
      .returns(accessToken)
      .withArgs('SF_ACCESS_TOKEN')
      // @ts-expect-error not sure why TS thinks a string is required.  getString can return undefined
      .returns(undefined);

    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(result).to.deep.equal(authFields);
    // no prompts needed when using Env
    expect(prompterStubs.confirm.callCount).to.equal(0);
    expect(prompterStubs.secret.callCount).to.equal(0);
  });
});
