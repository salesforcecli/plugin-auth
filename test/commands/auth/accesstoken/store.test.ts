/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { $$, expect } from '@salesforce/command/lib/test';
import { IConfig } from '@oclif/config';
import { AuthFields, AuthInfo, ConfigFile, SfdxError } from '@salesforce/core';
import { Crypto } from '@salesforce/core/lib/crypto';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { UX } from '@salesforce/command';
import { assert } from 'chai';
import { Env } from '@salesforce/kit';
import Store from '../../../../src/commands/auth/accesstoken/store';

describe('auth:accesstoken:store', () => {
  const config = stubInterface<IConfig>($$.SANDBOX, {});
  let authFields: AuthFields;
  let uxStub: StubbedType<UX>;
  const accessToken = '00Dxx0000000000!xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  /* eslint-disable camelcase */
  const userInfo = {
    preferred_username: 'foo@baz.org',
    organization_id: '00D000000000000',
    custom_domain: 'https://foo.bar.org.salesforce.com',
  };
  /* eslint-enable camelcase */

  async function createNewStoreCommand(
    flags: Record<string, string | boolean> = {},
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
    const ai = await AuthInfo.create({ username: authFields.username });
    ai.update(
      {
        accessToken,
        orgId: authFields.orgId,
        instanceUrl: authFields.instanceUrl,
        loginUrl: authFields.loginUrl,
        username: authFields.username,
      },
      false
    );
    stubInterface<AuthInfo>($$.SANDBOX, {
      getFields: () => authFields,
      save: () => {},
    });
    stubMethod($$.SANDBOX, Crypto.prototype, 'decrypt').callsFake(() => accessToken);
    stubMethod($$.SANDBOX, ConfigFile.prototype, 'exists').callsFake(async (): Promise<boolean> => authFileExists);
    stubMethod($$.SANDBOX, Store.prototype, 'saveAuthInfo').resolves(async () => userInfo);
    stubMethod($$.SANDBOX, Store.prototype, 'getUserInfo').resolves(ai);
    if (useSfdxAccessTokenEnvVar) {
      stubMethod($$.SANDBOX, Env.prototype, 'getString').callsFake(() => accessToken);
    }
    const store = new Store([], config);
    uxStub = stubInterface<UX>($$.SANDBOX, {
      prompt: () => promptAnswer,
    });
    // @ts-ignore because protected member
    store.ux = uxStub;
    // @ts-ignore because protected member
    store.flags = Object.assign(
      {},
      { instanceurl: { href: 'https://foo.bar.org.salesforce.com' }, noprompt: true },
      flags
    );
    return store;
  }

  it('should return auth fields after successful auth', async () => {
    const store = await createNewStoreCommand();
    const result = await store.run();
    expect(result).to.deep.equal(authFields);
  });

  it('should prompt for access token when accesstokenfile is not present', async () => {
    const store = await createNewStoreCommand();
    const result = await store.run();
    expect(uxStub.prompt.callCount).to.equal(1);
    expect(result).to.deep.equal(authFields);
  });

  it('should show invalid access token provided as input', async () => {
    const store = await createNewStoreCommand({}, 'invalidaccesstokenformat');
    try {
      await store.run();
      assert(false, 'should throw error');
    } catch (e) {
      const err = e as SfdxError;
      expect(err.message).to.include("The access token isn't in the correct format");
    }
  });

  it('should show that auth file already exists', async () => {
    const store = await createNewStoreCommand({ noprompt: false }, accessToken, true);
    await store.run();
    // prompt twice; one for access token and once to overwrite existing file
    expect(uxStub.prompt.calledTwice).to.be.true;
  });

  it('should show that auth file does not already exist', async () => {
    const store = await createNewStoreCommand({ noprompt: false }, accessToken);
    const result = await store.run();
    // prompt once; one for access token
    expect(uxStub.prompt.callCount).to.be.equal(1);
    expect(result).to.deep.equal(authFields);
  });
  it('should use env var SFDX_ACCESS_TOKEN as input to the store command', async () => {
    const store = await createNewStoreCommand({ noprompt: false }, accessToken, false, true);
    const result = await store.run();
    // no prompts
    expect(uxStub.prompt.callCount).to.be.equal(0);
    expect(result).to.deep.equal(authFields);
  });
});
