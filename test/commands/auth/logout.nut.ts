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
import { OrgAuthorization } from '@salesforce/core';
import { AuthListResults } from '../../../src/commands/auth/list';

describe('auth:logout NUTs', () => {
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
    const command = `auth:jwt:grant -d -u ${username} -i ${clientId} -f ${jwtKey} -r ${instanceUrl} --json`;
    execCmd(command, { ensureExitCode: 0 });
  });

  it('should remove the org specified by the -u flag (json)', () => {
    const json = execCmd(`auth:logout -p -u ${username} --json`, { ensureExitCode: 0 }).jsonOutput;
    expect(json).to.deep.equal({
      status: 0,
      result: [username],
    });

    const list = execCmd<AuthListResults>('auth:list --json', { ensureExitCode: 0 }).jsonOutput
      ?.result as AuthListResults;
    const found = !!list.find((r) => r.username === username);
    expect(found).to.be.false;
  });

  it('should clear any configs that use the removed username (json)', () => {
    execCmd(`config:set defaultusername=${username} --global`, { ensureExitCode: 0 });
    execCmd(`config:set defaultdevhubusername=${username} --global`, { ensureExitCode: 0 });
    const json = execCmd(`auth:logout -p -u ${username} --json`, { ensureExitCode: 0 }).jsonOutput;
    expect(json).to.deep.equal({
      status: 0,
      result: [username],
    });

    const list = execCmd<AuthListResults>('auth:list --json', { ensureExitCode: 0 }).jsonOutput
      ?.result as OrgAuthorization[];
    const found = !!list.find((r) => r.username === username);
    expect(found).to.be.false;

    const configGetUsername = execCmd<Array<{ key: string }>>('config:get defaultusername --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result as Array<{ key: string }>;
    expect(configGetUsername[0].key).to.equal('defaultusername');

    const configGetDevhub = execCmd<Array<{ key: string }>>('config:get defaultdevhubusername --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result as Array<{ key: string }>;
    expect(configGetDevhub[0].key).to.equal('defaultdevhubusername');
  });

  it('should remove the org specified by the -u flag (human readable)', () => {
    const result = execCmd(`auth:logout -p -u ${username}`, { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout');
    expect(output).to.include(`Successfully logged out of orgs: ${username}`);
  });

  it('should fail if there is no default org and the -u flag is not specified (json)', () => {
    const json = execCmd<{ name: string }>('auth:logout -p --json', { ensureExitCode: 1 }).jsonOutput?.result as {
      name: string;
    };
    expect(json.name).to.equal('NoOrgFound');
  });

  it('should remove the default username if the -u flag is not specified (json)', () => {
    execCmd(`config:set defaultusername=${username} --global`, { ensureExitCode: 0 });
    const json = execCmd('auth:logout -p --json', { ensureExitCode: 0 }).jsonOutput;
    expect(json).to.deep.equal({
      status: 0,
      result: [username],
    });

    // we expect the config for defaultusername to be cleared out after the logout
    const configGet = execCmd<Array<{ key: string }>>('config:get defaultusername --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result as Array<{ key: string }>;
    expect(configGet[0].key).to.equal('defaultusername');
  });
});
