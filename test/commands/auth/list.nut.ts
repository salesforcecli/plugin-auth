/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import { AuthorizationResult, expectAccessTokenToExist, scrubAccessTokens } from '../../testHelper';

let testSession: TestSession;

describe('auth:list NUTs', () => {
  before('ensure required environment variables exist', () => {
    const env = new Env();
    ensureString(env.getString('TESTKIT_JWT_KEY'));
    ensureString(env.getString('TESTKIT_JWT_CLIENT_ID'));
    ensureString(env.getString('TESTKIT_HUB_INSTANCE'));
    ensureString(env.getString('TESTKIT_HUB_USERNAME'));
    testSession = TestSession.create({});
  });

  it('should list auth files (json)', () => {
    const json = execCmd('auth:list --json', { ensureExitCode: 0 }).jsonOutput as AuthorizationResult;
    expectAccessTokenToExist(json.result[0]);
    const auths = scrubAccessTokens(json.result);
    expect(auths).to.deep.equal([
      {
        instanceUrl: 'https://gs0-dev-hub.my.salesforce.com',
        oauthMethod: 'jwt',
        orgId: '00DB0000000EfT0MAK',
        username: 'admin@integrationtesthubgs0.org',
      },
    ]);
  });

  it('should list auth files (human readable)', () => {
    const output = execCmd('auth:list', { ensureExitCode: 0 }).shellOutput.stdout;
    expect(output).to.equal(
      '=== authenticated orgs\n' +
        'ALIAS  USERNAME                         ORG ID              INSTANCE URL                           OAUTH METHOD\n' +
        '─────  ───────────────────────────────  ──────────────────  ─────────────────────────────────────  ────────────\n' +
        '       admin@integrationtesthubgs0.org  00DB0000000EfT0MAK  https://gs0-dev-hub.my.salesforce.com  jwt\n'
    );
  });
});

after(async () => {
  await testSession?.clean();
});
