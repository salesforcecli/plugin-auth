/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { execCmd, TestSession, prepareForJwt } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString, getString } from '@salesforce/ts-types';
import { AuthFields } from '@salesforce/core';
import { expectUrlToExist, expectOrgIdToExist, expectAccessTokenToExist } from '../../../testHelper';

let testSession: TestSession;

describe('auth:jwt:grant NUTs', () => {
  const env = new Env();
  let jwtKey: string;
  let username: string;
  let instanceUrl: string;
  let clientId: string;

  before('prepare session and ensure environment variables', () => {
    username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    instanceUrl = ensureString(env.getString('TESTKIT_HUB_INSTANCE'));
    clientId = ensureString(env.getString('TESTKIT_JWT_CLIENT_ID'));
    ensureString(env.getString('TESTKIT_JWT_KEY'));

    testSession = TestSession.create({ authStrategy: 'NONE' });
    jwtKey = prepareForJwt(testSession.homeDir);
  });

  after(async () => {
    await testSession?.clean();
  });

  afterEach(() => {
    execCmd(`auth:logout -p -u ${username}`, { ensureExitCode: 0 });
  });

  it('should authorize an org using jwt (json)', () => {
    const command = `auth:jwt:grant -d -u ${username} -i ${clientId} -f ${jwtKey} -r ${instanceUrl} --json`;
    const json = execCmd<AuthFields>(command, { ensureExitCode: 0 }).jsonOutput;
    expectAccessTokenToExist(json.result);
    expectOrgIdToExist(json.result);
    expectUrlToExist(json.result, 'instanceUrl');
    expectUrlToExist(json.result, 'loginUrl');
    expect(json.result.privateKey).to.equal(path.join(testSession.homeDir, 'jwtKey'));
    expect(json.result.username).to.equal(username);
  });

  it('should authorize an org using jwt (human readable)', () => {
    const command = `auth:jwt:grant -d -u ${username} -i ${clientId} -f ${jwtKey} -r ${instanceUrl}`;
    const result = execCmd(command, { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout');
    expect(output).to.include(`Successfully authorized ${username} with org ID`);
  });
});
