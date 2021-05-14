/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execCmd, TestSession, prepareForAccessToken, prepareForJwt } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString, getString } from '@salesforce/ts-types';
import { AuthFields, AuthInfo } from '@salesforce/core';
import { expectAccessTokenToExist, expectOrgIdToExist, expectUrlToExist } from '../../../testHelper';

let testSession: TestSession;

describe('auth:access:token NUTs', () => {
  const env = new Env();
  let accessTokenFile: string;
  let username: string;
  let instanceUrl: string;
  let clientId: string;
  let accessToken: string;

  before('prepare session and ensure environment variables', async () => {
    username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    instanceUrl = ensureString(env.getString('TESTKIT_HUB_INSTANCE'));
    clientId = ensureString(env.getString('TESTKIT_JWT_CLIENT_ID'));
    ensureString(env.getString('TESTKIT_JWT_KEY'));
    testSession = await TestSession.create({ authStrategy: 'NONE' });
    const jwtKeyFilePath = prepareForJwt(testSession.homeDir);
    execCmd(
      `auth:jwt:grant -f ${jwtKeyFilePath} -i ${clientId} -u ${username} --setdefaultdevhubusername --instanceurl ${instanceUrl} --json`,
      {
        ensureExitCode: 0,
      }
    );
    const authInfo = await AuthInfo.create({ username });
    accessToken = authInfo.getFields(true).accessToken;
    env.setString('TESTKIT_AUTH_ACCESS_TOKEN', accessToken);
    accessTokenFile = prepareForAccessToken(testSession.homeDir);
  });

  after(async () => {
    await testSession?.clean();
  });

  afterEach(() => {
    execCmd(`auth:logout -p -u ${username}`, { ensureExitCode: 0 });
  });

  it('should authorize an org using access token (json)', () => {
    const command = `auth:accesstoken:store --setdefaultdevhubusername --accesstokenfile ${accessTokenFile} --instanceurl ${instanceUrl} --noprompt --json`;
    const cmdresult = execCmd<AuthFields>(command, { ensureExitCode: 0 });
    const json = cmdresult.jsonOutput;

    expectAccessTokenToExist(json.result);
    expectOrgIdToExist(json.result);
    expectUrlToExist(json.result, 'instanceUrl');
    expectUrlToExist(json.result, 'loginUrl');
    expect(json.result.username).to.equal(username);
    expect(json.result.accessToken).to.equal(accessToken);
  });

  it('should authorize an org using access token (human readable)', () => {
    const command = `auth:accesstoken:store --setdefaultdevhubusername --accesstokenfile ${accessTokenFile} --instanceurl ${instanceUrl} --noprompt`;
    const result = execCmd(command, { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout');
    expect(output).to.include(`Successfully authorized ${username} with org ID`);
  });
});
