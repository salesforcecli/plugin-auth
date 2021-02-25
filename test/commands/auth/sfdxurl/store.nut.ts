/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execCmd, TestSession, prepareForAuthUrl } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString, getString } from '@salesforce/ts-types';
import { AuthFields } from '@salesforce/core';
import { Result, expectPropsToExist, scrubSecrets } from '../../../testHelper';

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
    await testSession.clean();
  });

  afterEach(() => {
    execCmd(`auth:logout -p -u ${username}`, { ensureExitCode: 0 });
  });

  it('should authorize an org using sfdxurl (json)', () => {
    const command = `auth:sfdxurl:store -d -f ${authUrl} --json`;
    const json = execCmd(command, { ensureExitCode: 0 }).jsonOutput as Result<AuthFields>;
    expectPropsToExist(json.result, 'accessToken', 'refreshToken');
    const auths = scrubSecrets(json.result);
    expect(auths).to.deep.equal({
      loginUrl: 'https://gs0-dev-hub.my.salesforce.com',
      instanceUrl: 'https://gs0-dev-hub.my.salesforce.com',
      orgId: '00DB0000000EfT0MAK',
      username,
    });
  });

  it('should authorize an org using sfdxurl (human readable)', () => {
    const command = `auth:sfdxurl:store -d -f ${authUrl}`;
    const result = execCmd(command, { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout', '');
    expect(output).to.equal(`Successfully authorized ${username} with org ID 00DB0000000EfT0MAK\n`);
  });
});
