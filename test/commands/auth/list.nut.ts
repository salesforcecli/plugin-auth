/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString, getString } from '@salesforce/ts-types';
import { OrgAuthorization } from '@salesforce/core';
import { expectUrlToExist, expectOrgIdToExist, expectAccessTokenToExist } from '../../testHelper';

describe('auth:list NUTs', () => {
  let testSession: TestSession;
  let username: string;

  before('prepare session and ensure environment variables', async () => {
    const env = new Env();
    ensureString(env.getString('TESTKIT_JWT_KEY'));
    ensureString(env.getString('TESTKIT_JWT_CLIENT_ID'));
    ensureString(env.getString('TESTKIT_HUB_INSTANCE'));
    username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    testSession = await TestSession.create({});
  });

  after(async () => {
    await testSession?.clean();
  });

  it('should list auth files (json)', () => {
    const json = execCmd<OrgAuthorization[]>('auth:list --json', { ensureExitCode: 0 }).jsonOutput;
    const auth = json.result[0];
    expectAccessTokenToExist(auth);
    expectOrgIdToExist(auth);
    expectUrlToExist(auth, 'instanceUrl');
    expect(auth.username).to.equal(username);
  });

  it('should list auth files (human readable)', () => {
    const result = execCmd('auth:list', { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout');
    expect(output).to.include(username);
    expect(output).to.include('jwt');
  });
});
