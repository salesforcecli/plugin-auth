/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execCmd, TestSession, prepareForJwt } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { Env } from '@salesforce/kit';
import { ensureString, getString } from '@salesforce/ts-types';
import { AuthListResults } from '../../../src/commands/org/list/auth.js';

describe('org:logout NUTs', () => {
  const env = new Env();
  let testSession: TestSession;
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

  beforeEach(() => {
    const command = `org:login:jwt -d -o ${username} -i ${clientId} -f ${jwtKey} -r ${instanceUrl} --json`;
    execCmd(command, { ensureExitCode: 1 });
  });

  it('should remove the org specified by the -o flag (json)', () => {
    const json = execCmd(`org:logout -p -o ${username} --json`, { ensureExitCode: 0 }).jsonOutput;
    expect(json).to.deep.equal({
      status: 0,
      result: [username],
      warnings: [],
    });

    const list = execCmd<AuthListResults>('org:list:auth --json', { ensureExitCode: 0 }).jsonOutput
      ?.result as AuthListResults;
    const found = !!list.find((r) => r.username === username);
    expect(found).to.be.false;
  });

  it('should clear any configs that use the removed username (json)', () => {
    execCmd(`config:set target-org=${username} --global`, { ensureExitCode: 0, cli: 'sf' });
    execCmd(`config:set target-dev-hub=${username} --global`, { ensureExitCode: 0, cli: 'sf' });
    const json = execCmd(`org:logout -p -o ${username} --json`, { ensureExitCode: 0 }).jsonOutput;
    expect(json).to.deep.equal({
      status: 0,
      result: [username],
      warnings: [],
    });

    const list = execCmd<AuthListResults>('org:list:auth --json', { ensureExitCode: 0 }).jsonOutput
      ?.result as AuthListResults;
    const found = !!list.find((r) => r.username === username);
    expect(found).to.be.false;

    const configGetUsername = execCmd<Array<{ key: string }>>('config:get target-org --json', {
      ensureExitCode: 0,
      cli: 'sf',
    }).jsonOutput?.result as Array<{ key: string }>;
    expect(['target-org', 'defaultusername']).to.include(configGetUsername[0].key);

    const configGetDevhub = execCmd<Array<{ key: string }>>('config:get target-dev-hub --json', {
      ensureExitCode: 0,
      cli: 'sf',
    }).jsonOutput?.result as Array<{ key: string }>;
    expect(['target-dev-hub', 'defaultdevhubusername']).to.include(configGetDevhub[0].key);
  });

  it('should remove the org specified by the -o flag (human readable)', () => {
    const result = execCmd(`org:logout -p -o ${username}`, { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout');
    expect(output).to.include(`Successfully logged out of orgs: ${username}`);
  });

  it('should fail if there is no default org and the -o flag is not specified (json)', () => {
    const json = execCmd<{ name: string }>('org:logout -p --json', { ensureExitCode: 1 }).jsonOutput;
    expect(json?.name).to.equal('NoOrgSpecifiedWithNoPromptError');
  });

  it('should remove the default username if the -o flag is not specified (json)', () => {
    execCmd(`config:set target-org=${username} --global`, { ensureExitCode: 0, cli: 'sf' });
    const json = execCmd('org:logout -p --json', { ensureExitCode: 0 }).jsonOutput;
    expect(json).to.deep.equal({
      status: 0,
      result: [username],
      warnings: [],
    });

    // we expect the config for target-org to be cleared out after the logout
    const configGet = execCmd<Array<{ key: string }>>('config:get target-org --json', {
      ensureExitCode: 0,
      cli: 'sf',
    }).jsonOutput?.result as Array<{ key: string }>;
    expect(['target-org', 'defaultusername']).to.include(configGet[0].key);
  });
});
