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
import { AuthorizationResult, expectAccessTokenToExist, scrubAccessTokens } from '../../../testHelper';

let testSession: TestSession;

describe('auth:sfdxurl:store NUTs', () => {
  const env = new Env();

  before('ensure required environment variables exist', () => {
    ensureString(env.getString('TESTKIT_AUTH_URL'));

    // Unset these env vars so that testkit doesn't default to jwt auth
    env.unset('TESTKIT_JWT_KEY');
    env.unset('TESTKIT_JWT_CLIENT_ID');
    env.unset('TESTKIT_HUB_INSTANCE');
    env.unset('TESTKIT_HUB_USERNAME');
  });

  beforeEach(() => {
    testSession = TestSession.create({});
  });

  afterEach(async () => {
    await testSession.clean();
  });

  it('should authorize an org using sfdxurl', () => {
    // TestSession does sfdxurl auth for us, so we just want to make sure that the auth file exists
    const json = execCmd('auth:list --json', { ensureExitCode: 0 }).jsonOutput as AuthorizationResult;
    expectAccessTokenToExist(json.result[0]);
    const auths = scrubAccessTokens(json.result);
    expect(auths).to.deep.equal([
      {
        instanceUrl: 'https://gs0-dev-hub.my.salesforce.com',
        oauthMethod: 'web',
        orgId: '00DB0000000EfT0MAK',
        username: 'admin@integrationtesthubgs0.org',
      },
    ]);
  });
});
