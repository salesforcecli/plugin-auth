/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { expect } from 'chai';

import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { Env } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { AuthFields, OrgAuthorization } from '@salesforce/core';
import { readJson } from 'fs-extra';

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
      project: { name: 'ScratchIDProject' },
      scratchOrgs: [
        {
          executable: 'sfdx',
          duration: 1,
          setDefault: true,
          config: path.join('config', 'project-scratch-def.json'),
        },
      ],
    });

    orgUsername = [...testSession.orgs.keys()][0];
    orgInstanceUrl = testSession.orgs.get(orgUsername).instanceUrl;

    // we'll need this path for testing
    jwtKey = path.join(testSession.homeDir, 'jwtKey');
  });

  after(async () => {
    await testSession?.clean();
  });

  it('should have the scratch org in auth files', () => {
    const list = execCmd<OrgAuthorization[]>('auth:list --json', { ensureExitCode: 0 }).jsonOutput;
    const found = !!list.result.find((r) => r.username === orgUsername);
    expect(found).to.be.true;
  });

  it('should logout from the org)', () => {
    execCmd(`auth:logout -u ${orgUsername} --noprompt`, { ensureExitCode: 0 });
  });

  it('should NOT have the scratch org in auth files', () => {
    const list = execCmd<OrgAuthorization[]>('auth:list --json', { ensureExitCode: 0 }).jsonOutput;
    const found = !!list.result.find((r) => r.username === orgUsername);
    expect(found).to.be.false;
  });

  it('should login to the org via jwt grant', async function () {
    const env = new Env();
    const command = `auth:jwt:grant -f ${jwtKey} --username ${orgUsername} --clientid ${env.getString(
      'TESTKIT_JWT_CLIENT_ID'
    )} -r ${orgInstanceUrl} --json`;
    const output = execCmd<AuthFields>(command, {
      ensureExitCode: 0,
    }).jsonOutput.result;
    expect(output.username).to.equal(orgUsername);
  });

  it('should have the devhubUsername in the auth file', async () => {
    const fileContents = (await readJson(path.join(testSession.homeDir, '.sfdx', `${orgUsername}.json`))) as {
      devHubUsername: string;
    };
    expect(fileContents.devHubUsername).to.equal(hubUsername);
  });
});
