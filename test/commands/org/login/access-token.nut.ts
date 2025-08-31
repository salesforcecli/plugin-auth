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
import { execCmd, TestSession, prepareForJwt } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString, getString } from '@salesforce/ts-types';
import { AuthFields } from '@salesforce/core';
import { expectAccessTokenToExist, expectOrgIdToExist, expectUrlToExist } from '../../../testHelper.js';

let testSession: TestSession;

describe('org:login:access-token NUTs', () => {
  const env = new Env();
  let username: string;
  let instanceUrl: string;
  let clientId: string;
  let accessToken: string;

  before('prepare session and ensure environment variables', async () => {
    username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    instanceUrl = ensureString(env.getString('TESTKIT_HUB_INSTANCE'));
    clientId = ensureString(env.getString('TESTKIT_JWT_CLIENT_ID'));
    ensureString(env.getString('TESTKIT_JWT_KEY'));
    testSession = await TestSession.create();
    const jwtKeyFilePath = prepareForJwt(testSession.homeDir);
    const res = execCmd<{ accessToken: string }>(
      `org:login:jwt -f ${jwtKeyFilePath} -i ${clientId} -o ${username} --set-default-dev-hub --instance-url ${instanceUrl} --json`,
      {
        ensureExitCode: 0,
      }
    );
    accessToken = res.jsonOutput?.result.accessToken as string;
    env.setString('SF_ACCESS_TOKEN', accessToken);
    execCmd(`auth:logout -p -o ${username}`, { ensureExitCode: 0 });
  });

  after(async () => {
    await testSession?.clean();
  });

  afterEach(() => {
    execCmd(`auth:logout -p -o ${username}`, { ensureExitCode: 0 });
  });

  it('should authorize an org using access token (json)', () => {
    const command = `org:login:access-token --set-default-dev-hub --instance-url ${instanceUrl} --no-prompt --json`;
    const cmdresult = execCmd<AuthFields>(command, { ensureExitCode: 0 });
    const json = cmdresult.jsonOutput?.result as AuthFields;

    expectAccessTokenToExist(json);
    expectOrgIdToExist(json);
    expectUrlToExist(json, 'instanceUrl');
    expectUrlToExist(json, 'loginUrl');
    expect(json.username).to.equal(username);
    expect(json.accessToken).to.equal(accessToken);
  });

  it('should authorize an org using access token (human readable)', () => {
    const command = `org:login:access-token --set-default-dev-hub --instance-url ${instanceUrl} --no-prompt`;
    const result = execCmd(command, { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout');
    expect(output).to.include(`Successfully authorized ${username} with org ID`);
  });
});
