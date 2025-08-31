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

import * as path from 'node:path';
import { expect } from 'chai';

import { execCmd, TestSession, prepareForJwt } from '@salesforce/cli-plugins-testkit';
import { Env } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { AuthFields, AuthInfo } from '@salesforce/core';
import { AuthListResults } from '../../src/commands/org/list/auth.js';

describe('verify discovery/id of scratch org', () => {
  let testSession: TestSession;
  let hubUsername: string;
  let orgUsername: string;
  let jwtKey: string;
  let orgInstanceUrl: string;

  before('prepare session and ensure environment variables', async () => {
    const env = new Env();
    ensureString(env.getString('TESTKIT_JWT_KEY'));
    ensureString(env.getString('TESTKIT_JWT_CLIENT_ID'));
    ensureString(env.getString('TESTKIT_HUB_INSTANCE'));
    hubUsername = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    testSession = await TestSession.create({
      devhubAuthStrategy: 'AUTO',
      project: { name: 'ScratchIDProject' },
      scratchOrgs: [
        {
          setDefault: true,
          config: path.join('config', 'project-scratch-def.json'),
        },
      ],
    });

    orgUsername = [...testSession.orgs.keys()][0];
    orgInstanceUrl = (testSession.orgs.get(orgUsername)?.instanceUrl ?? 'https://test.salesforce.com').replace(
      '.com/',
      '.com'
    );

    // we'll need this path for testing
    jwtKey = prepareForJwt(testSession.homeDir);
  });

  after(async () => {
    await testSession?.clean();
  });

  it('should have the scratch org in auth files', () => {
    const list = execCmd<AuthListResults>('org:list:auth --json', { ensureExitCode: 0 }).jsonOutput
      ?.result as AuthListResults;
    const found = !!list.find((r) => r.username === orgUsername);
    expect(found).to.be.true;
  });

  it('should logout from the org)', () => {
    execCmd(`org:logout -o ${orgUsername} --no-prompt`, { ensureExitCode: 0 });
  });

  it('should NOT have the scratch org in auth files', () => {
    const list = execCmd<AuthListResults>('org:list:auth --json', { ensureExitCode: 0 }).jsonOutput
      ?.result as AuthListResults;
    const found = !!list.find((r) => r.username === orgUsername);
    expect(found).to.be.false;
  });

  it('should login to the org via jwt grant', async () => {
    const env = new Env();
    const command = `org:login:jwt -f ${jwtKey} --username ${orgUsername} --client-id ${env.getString(
      'TESTKIT_JWT_CLIENT_ID'
    )} -r ${orgInstanceUrl} --json`;
    const output = execCmd<AuthFields>(command, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    const authInfo = await AuthInfo.create({ username: orgUsername });
    expect(output?.username).to.equal(orgUsername);
    expect(authInfo?.getFields().devHubUsername).to.equal(hubUsername);
  });
});
