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
import { execCmd, TestSession, prepareForJwt } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString, getString } from '@salesforce/ts-types';
import { AuthFields } from '@salesforce/core';
import { expectUrlToExist, expectOrgIdToExist, expectAccessTokenToExist } from '../../../testHelper.js';

let testSession: TestSession;

describe('org:login:jwt NUTs', () => {
  const env = new Env();
  let jwtKey: string;
  let username: string;
  let instanceUrl: string;
  let clientId: string;

  before('prepare session and ensure environment variables', async () => {
    username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    instanceUrl = ensureString(env.getString('TESTKIT_HUB_INSTANCE'));
    clientId = ensureString(env.getString('TESTKIT_JWT_CLIENT_ID'));
    ensureString(env.getString('TESTKIT_JWT_KEY'));

    testSession = await TestSession.create();
    jwtKey = prepareForJwt(testSession.homeDir);
  });

  after(async () => {
    await testSession?.clean();
  });

  it('should authorize an org using jwt (json)', () => {
    const command = `org:login:jwt -d -o ${username} -i ${clientId} -f ${jwtKey} -r ${instanceUrl} --json`;
    const json = execCmd<AuthFields>(command, { ensureExitCode: 0 }).jsonOutput?.result as AuthFields;
    expectAccessTokenToExist(json);
    expectOrgIdToExist(json);
    expectUrlToExist(json, 'instanceUrl');
    expectUrlToExist(json, 'loginUrl');
    expect(json.privateKey).to.equal(path.join(testSession.homeDir, 'jwtKey'));
    expect(json.username).to.equal(username);
    execCmd(`auth:logout -p -o ${username}`, { ensureExitCode: 0 });
  });

  it('should authorize an org using jwt (human readable)', () => {
    const command = `org:login:jwt -d -o ${username} -i ${clientId} -f ${jwtKey} -r ${instanceUrl}`;
    const result = execCmd(command, { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout');
    expect(output).to.include(`Successfully authorized ${username} with org ID`);
    execCmd(`auth:logout -p -o ${username}`, { ensureExitCode: 0 });
  });

  it('should throw correct error for JwtAuthError', () => {
    const command = `org:login:jwt -d -o ${username} -i incorrect -f ${jwtKey} -r ${instanceUrl} --json`;
    const json = execCmd(command).jsonOutput;
    expect(json).to.have.property('name', 'JwtGrantError');
    expect(json).to.have.property('exitCode', 1);
    expect(json)
      .to.have.property('message')
      .and.include(
        'We encountered a JSON web token error, which is likely not an issue with Salesforce CLI. Here’s the error: JwtAuthError::Error authenticating with JWT.'
      );
    expect(json).to.have.property('stack').and.include('client identifier invalid');
    expect(json).to.have.property('cause').and.include('SfError [JwtAuthError]: Error authenticating with JWT.');
    expect(json).to.have.property('cause').and.include('at AuthInfo.authJwt');
  });
});
