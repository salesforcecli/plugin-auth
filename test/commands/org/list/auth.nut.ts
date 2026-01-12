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
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString, getString } from '@salesforce/ts-types';
import { expectUrlToExist, expectOrgIdToExist, expectAccessTokenToExist } from '../../../testHelper.js';
import { AuthListResults } from '../../../../src/commands/org/list/auth.js';

describe('org:list:auth NUTs', () => {
  let testSession: TestSession;
  let username: string;

  before('prepare session and ensure environment variables', async () => {
    const env = new Env();
    ensureString(env.getString('TESTKIT_JWT_KEY'));
    ensureString(env.getString('TESTKIT_JWT_CLIENT_ID'));
    ensureString(env.getString('TESTKIT_HUB_INSTANCE'));
    username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    testSession = await TestSession.create({
      devhubAuthStrategy: 'AUTO',
    });
  });

  after(async () => {
    await testSession?.clean();
  });

  it('should list auth files (json)', () => {
    const json = execCmd<AuthListResults>('org:list:auth --json', { ensureExitCode: 0 }).jsonOutput
      ?.result as AuthListResults;
    const auth = json[0];
    expectAccessTokenToExist(auth);
    expectOrgIdToExist(auth);
    expectUrlToExist(auth, 'instanceUrl');
    expect(auth.username).to.equal(username);
  });

  it('should list auth files (human readable)', () => {
    const result = execCmd('org:list:auth', { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout');
    expect(output).to.include(username);
    expect(output).to.include('jwt');
  });
});
