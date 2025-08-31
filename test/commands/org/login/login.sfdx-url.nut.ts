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
} from '../../../testHelper.js';

let testSession: TestSession;

describe('org:login:sfdx-url NUTs', () => {
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

  it('should authorize an org using sfdx-url (json)', () => {
    const command = `org:login:sfdx-url -d -f ${authUrl} --json`;
    const json = execCmd<AuthFields>(command, { ensureExitCode: 0 }).jsonOutput?.result as AuthFields;

    expectPropsToExist(json, 'refreshToken');
    expectAccessTokenToExist(json);
    expectOrgIdToExist(json);
    expectUrlToExist(json, 'instanceUrl');
    expectUrlToExist(json, 'loginUrl');
    expect(json.username).to.equal(username);
  });

  it('should authorize an org using sfdx-url (human readable)', () => {
    const command = `org:login:sfdx-url -d -f ${authUrl}`;
    const result = execCmd(command, { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout');
    expect(output).to.include(`Successfully authorized ${username} with org ID`);
  });
});
