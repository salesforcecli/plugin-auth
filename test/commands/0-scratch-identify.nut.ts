/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { expect } from 'chai';

import { execCmd, TestSession, prepareForJwt } from '@salesforce/cli-plugins-testkit';
import { Env } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { AuthFields, AuthInfo } from '@salesforce/core';
import { AuthListResults } from '../../src/commands/org/list/auth';

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
