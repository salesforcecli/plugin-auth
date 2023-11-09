/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { AuthFields, AuthInfo, SfError, StateAggregator } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
import { assert, expect } from 'chai';
import { TestContext } from '@salesforce/core/lib/testSetup.js';
import { Env } from '@salesforce/kit';
import { Config } from '@oclif/core';
import Store from '../../../../src/commands/org/login/access-token.js';

describe('org:login:access-token', () => {
  const $$ = new TestContext();

  let authFields: AuthFields;
  const accessToken = '00Dxx0000000000!xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  /* eslint-disable camelcase */
  const userInfo = {
    preferred_username: 'foo@baz.org',
    organization_id: '00D000000000000',
    custom_domain: 'https://foo.bar.org.salesforce.com',
  };
  /* eslint-enable camelcase */

  async function createNewStoreCommand(
    flags: string[] = [],
    promptAnswer = accessToken,
    authFileExists = false,
    useSfdxAccessTokenEnvVar = false
  ): Promise<Store> {
    authFields = {
      accessToken,
      instanceUrl: 'https://foo.bar.org.salesforce.com',
      loginUrl: 'https://foo.bar.org.salesforce.com',
      orgId: '00D000000000000',
      username: 'foo@baz.org',
    };

    stubMethod($$.SANDBOX, StateAggregator, 'getInstance').resolves({
      orgs: {
        exists: () => Promise.resolve(authFileExists),
      },
    });
    stubMethod($$.SANDBOX, Store.prototype, 'saveAuthInfo').resolves(userInfo);
    stubMethod($$.SANDBOX, AuthInfo.prototype, 'getUsername').returns(authFields.username);
    stubMethod($$.SANDBOX, AuthInfo.prototype, 'getFields').returns({
      accessToken,
      orgId: authFields.orgId,
      instanceUrl: authFields.instanceUrl,
      loginUrl: authFields.loginUrl,
      username: authFields.username,
    });
    stubMethod($$.SANDBOX, Store.prototype, 'getUserInfo').resolves(AuthInfo.prototype);
    if (useSfdxAccessTokenEnvVar) {
      stubMethod($$.SANDBOX, Env.prototype, 'getString').callsFake(() => accessToken);
    }
    const store = new Store(
      [...new Set(['--instance-url', 'https://foo.bar.org.salesforce.com', '--no-prompt', ...flags])],
      {} as Config
    );
    // @ts-ignore
    $$.SANDBOX.stub(Store.prototype, 'askForAccessToken').resolves(promptAnswer);

    return Promise.resolve(store);
  }

  it('should return auth fields after successful auth', async () => {
    const store = await createNewStoreCommand(['--instance-url', 'https://foo.bar.org.salesforce.com', '--no-prompt']);
    const result = await store.run();
    expect(result).to.deep.equal(authFields);
  });

  it('should prompt for access token when accesstokenfile is not present', async () => {
    const store = await createNewStoreCommand(['--instance-url', 'https://foo.bar.org.salesforce.com', '--no-prompt']);
    const result = await store.run();
    expect(result).to.deep.equal(authFields);
  });

  it('should show invalid access token provided as input', async () => {
    const store = await createNewStoreCommand(
      ['--instance-url', 'https://foo.bar.org.salesforce.com', '--no-prompt'],
      'invalidaccesstokenformat'
    );
    try {
      await store.run();
      assert(false, 'should throw error');
    } catch (e) {
      const err = e as SfError;
      expect(err.message).to.include("The access token isn't in the correct format");
    }
  });

  it('should show that auth file already exists', async () => {
    const store = await createNewStoreCommand(
      ['--instance-url', 'https://foo.bar.org.salesforce.com'],
      accessToken,
      true
    );
    await store.run();
  });

  it('should show that auth file does not already exist', async () => {
    const store = await createNewStoreCommand(['--instance-url', 'https://foo.bar.org.salesforce.com'], accessToken);
    const result = await store.run();
    // prompt once; one for access token
    expect(result).to.deep.equal(authFields);
  });
  it('should use env var SFDX_ACCESS_TOKEN as input to the store command', async () => {
    const store = await createNewStoreCommand(
      ['--instance-url', 'https://foo.bar.org.salesforce.com'],
      accessToken,
      false,
      true
    );
    const result = await store.run();
    // no prompts
    expect(result).to.deep.equal(authFields);
  });
});
