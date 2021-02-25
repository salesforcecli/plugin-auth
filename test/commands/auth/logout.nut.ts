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

let testSession: TestSession;

describe('auth:logout NUTs', () => {
  const env = new Env();

  before('ensure required environment variables exist', () => {
    ensureString(env.getString('TESTKIT_JWT_KEY'));
    ensureString(env.getString('TESTKIT_JWT_CLIENT_ID'));
    ensureString(env.getString('TESTKIT_HUB_INSTANCE'));
    ensureString(env.getString('TESTKIT_HUB_USERNAME'));
  });

  beforeEach(() => {
    testSession = TestSession.create({});
  });

  afterEach(async () => {
    await testSession.clean();
  });

  it('should remove the org specified by the -u flag (json)', () => {
    const username = env.getString('TESTKIT_HUB_USERNAME');
    const json = execCmd(`auth:logout -p -u ${username} --json`, { ensureExitCode: 0 }).jsonOutput;
    expect(json).to.deep.equal({
      status: 0,
      result: [username],
    });
  });

  it('should remove the org specified by the -u flag (human readable)', () => {
    const username = env.getString('TESTKIT_HUB_USERNAME');
    const output = execCmd(`auth:logout -p -u ${username}`, { ensureExitCode: 0 }).shellOutput.stdout;
    expect(output).to.equal(`Successfully logged out of orgs: ${username}\n`);
  });

  it('should fail if there is no default org and the -u flag is not specified (json)', () => {
    const json = execCmd('auth:logout -p --json', { ensureExitCode: 1 }).jsonOutput as { name: string };
    expect(json.name).to.equal('NoOrgFound');
  });

  it('should remove the default username if the -u flag is not specified (json)', () => {
    const username = env.getString('TESTKIT_HUB_USERNAME');
    execCmd(`config:set defaultusername=${username} --global`, { ensureExitCode: 0 });
    const json = execCmd('auth:logout -p --json', { ensureExitCode: 0 }).jsonOutput;
    expect(json).to.deep.equal({
      status: 0,
      result: [username],
    });
  });
});
