/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execCmd, TestSession, prepareForAuthUrl } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { AuthFields } from '@salesforce/core';
import {
  expectPropsToExist,
  expectAccessTokenToExist,
  expectOrgIdToExist,
  expectUrlToExist,
} from '../../../testHelper';

let testSession: TestSession;

describe('auth:sfdxurl:store NUTs', () => {
  const env = new Env();
  let authUrl: string;
  let username: string;

  before('prepare session and ensure environment variables', () => {
    ensureString(env.getString('TESTKIT_AUTH_URL'));
    username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    testSession = TestSession.create({ authStrategy: 'NONE' });
    authUrl = prepareForAuthUrl(testSession.homeDir);
  });

  after(async () => {
    await testSession?.clean();
  });

  afterEach(() => {
    execCmd(`auth:logout -p -u ${username}`, { ensureExitCode: 0 });
  });

  it('should authorize an org using sfdxurl (json)', () => {
    const command = `auth:sfdxurl:store -d -f ${authUrl} --json`;
    const json = execCmd<AuthFields>(command, { ensureExitCode: 0 }).jsonOutput;

    expectPropsToExist(json.result, 'refreshToken');
    expectAccessTokenToExist(json.result);
    expectOrgIdToExist(json.result);
    expectUrlToExist(json.result, 'instanceUrl');
    expectUrlToExist(json.result, 'loginUrl');
    expect(json.result.username).to.equal(username);
  });

  it('should authorize an org using sfdxurl (human readable)', () => {
    const command = `auth:sfdxurl:store -d -f ${authUrl}`;
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;
    expect(output).to.include(`Successfully authorized ${username} with org ID`);
  });
});
