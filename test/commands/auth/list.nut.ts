/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString, getString } from '@salesforce/ts-types';
import { Authorization } from '@salesforce/core';
import { Result, expectPropsToExist, scrubSecrets } from '../../testHelper';

let testSession: TestSession;

describe('auth:list NUTs', () => {
  let username: string;

  before('ensure required environment variables exist', () => {
    const env = new Env();
    ensureString(env.getString('TESTKIT_JWT_KEY'));
    ensureString(env.getString('TESTKIT_JWT_CLIENT_ID'));
    ensureString(env.getString('TESTKIT_HUB_INSTANCE'));
    username = ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    testSession = TestSession.create({});
  });

  it('should list auth files (json)', () => {
    const json = execCmd('auth:list --json', { ensureExitCode: 0 }).jsonOutput as Result<Authorization[]>;
    expectPropsToExist(json.result[0], 'accessToken');
    const auths = scrubSecrets(json.result);
    expect(auths).to.deep.equal([
      {
        instanceUrl: 'https://gs0-dev-hub.my.salesforce.com',
        oauthMethod: 'jwt',
        orgId: '00DB0000000EfT0MAK',
        username,
      },
    ]);
  });

  it('should list auth files (human readable)', () => {
    const result = execCmd('auth:list', { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout');
    expect(output).to.equal(
      '=== authenticated orgs\n' +
        'ALIAS  USERNAME                         ORG ID              INSTANCE URL                           OAUTH METHOD\n' +
        '─────  ───────────────────────────────  ──────────────────  ─────────────────────────────────────  ────────────\n' +
        `       ${username}  00DB0000000EfT0MAK  https://gs0-dev-hub.my.salesforce.com  jwt\n`
    );
  });
});

after(async () => {
  await testSession?.clean();
});
