/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execCmd, prepareForAuthUrl, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString, getString } from '@salesforce/ts-types';
import { AuthFields } from '@salesforce/core';
import {
  expectAccessTokenToExist,
  expectOrgIdToExist,
  expectPropsToExist,
  expectUrlToExist,
} from '../../../testHelper';

let testSession: TestSession;

describe('auth:sfdxurl:store NUTs', () => {
  const env = new Env();
  let authUrl: string;
  let username: string;

  before('prepare session and ensure environment variables', async () => {
    ensureString(env.getString('TESTKIT_AUTH_URL'));
    username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    testSession = await TestSession.create();
    authUrl = prepareForAuthUrl(testSession.homeDir);
  });

  after(async () => {
    await testSession?.clean();
  });

  afterEach(() => {
    execCmd(`auth:logout -p -o ${username}`, { ensureExitCode: 0 });
  });

  it('should authorize an org using sfdxurl (json)', () => {
    const command = `auth:sfdxurl:store -d -f ${authUrl} --json`;
    const json = execCmd<AuthFields>(command, { ensureExitCode: 0 }).jsonOutput?.result as AuthFields;

    expectPropsToExist(json, 'refreshToken');
    expectAccessTokenToExist(json);
    expectOrgIdToExist(json);
    expectUrlToExist(json, 'instanceUrl');
    expectUrlToExist(json, 'loginUrl');
    expect(json.username).to.equal(username);
  });

  it('should authorize an org using sfdxurl (human readable)', () => {
    const command = `auth:sfdxurl:store -d -f ${authUrl}`;
    const result = execCmd(command, { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout');
    expect(output).to.include(`Successfully authorized ${username} with org ID`);
  });
});
