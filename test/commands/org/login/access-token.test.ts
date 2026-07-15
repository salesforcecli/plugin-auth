/*
 * Copyright 2026, Salesforce, Inc.
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

import { Readable } from 'node:stream';
import { AuthFields, AuthInfo, StateAggregator } from '@salesforce/core';
import { assert, expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import { stubPrompter, stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { env } from '@salesforce/kit';
import Store from '../../../../src/commands/org/login/access-token.js';

describe('org:login:access-token', () => {
  const $$ = new TestContext();
  const accessToken = '00Dxx0000000000!xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  const authFields = {
    accessToken,
    instanceUrl: 'https://foo.bar.org.salesforce.com',
    loginUrl: 'https://foo.bar.org.salesforce.com',
    orgId: '00D000000000000',
    username: 'foo@baz.org',
  } as const satisfies AuthFields;

  const redactedAuthFields = {
    ...authFields,
    accessToken: "[REDACTED] Use 'sf org auth show-access-token' to view",
    refreshToken: undefined,
    clientSecret: undefined,
    password: undefined,
  };

  /* eslint-disable camelcase */
  const userInfo = {
    preferred_username: 'foo@baz.org',
    organization_id: '00D000000000000',
    custom_domain: 'https://foo.bar.org.salesforce.com',
  };
  /* eslint-enable camelcase */
  let stubSfCommandUxStubs: ReturnType<typeof stubSfCommandUx>;
  let prompterStubs: ReturnType<typeof stubPrompter>;
  const originalStdin = process.stdin;

  const setStdinIsTTY = (isTTY: boolean): void => {
    Object.defineProperty(process.stdin, 'isTTY', { value: isTTY, configurable: true });
  };

  /** Ensure the token env vars don't short-circuit the stdin-reading path. */
  const stubNoTokenEnv = (): void => {
    $$.SANDBOX.stub(env, 'getString')
      .withArgs('SF_ACCESS_TOKEN')
      // @ts-expect-error getString can return undefined
      .returns(undefined)
      .withArgs('SFDX_ACCESS_TOKEN')
      // @ts-expect-error getString can return undefined
      .returns(undefined);
  };

  /** Replace process.stdin with a non-TTY readable and clear any token env vars. */
  const useStdin = (readable: Readable): void => {
    stubNoTokenEnv();
    Object.defineProperty(readable, 'isTTY', { value: undefined, configurable: true });
    Object.defineProperty(process, 'stdin', { value: readable, configurable: true });
  };

  /** Simulate a non-TTY stdin that emits `content` then EOF. */
  const pipeToStdin = (content: string): void => {
    useStdin(Readable.from([content]));
  };

  /** A non-TTY stdin that is open but never sends data or EOF (would hang without a timeout). */
  const openStdin = (): Readable => {
    const stdin = new Readable({
      read(): void {
        /* no-op: never emits data or end */
      },
    });
    useStdin(stdin);
    return stdin;
  };

  /** Wait until the command under test has attached its stdin 'data' listener. */
  const waitForStdinRead = async (stdin: Readable): Promise<void> => {
    while (stdin.listenerCount('data') === 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setImmediate(resolve));
    }
  };

  beforeEach(() => {
    // default to an interactive terminal; individual tests override as needed
    setStdinIsTTY(true);
    // @ts-expect-error because private method
    $$.SANDBOX.stub(Store.prototype, 'saveAuthInfo').resolves(userInfo);
    $$.SANDBOX.stub(AuthInfo.prototype, 'getUsername').returns(authFields.username);
    $$.SANDBOX.stub(AuthInfo.prototype, 'getFields').returns({
      accessToken,
      orgId: authFields.orgId,
      instanceUrl: authFields.instanceUrl,
      loginUrl: authFields.loginUrl,
      username: authFields.username,
    });
    // @ts-expect-error because private method
    $$.SANDBOX.stub(Store.prototype, 'getUserInfo').resolves(AuthInfo.prototype);
    stubSfCommandUxStubs = stubSfCommandUx($$.SANDBOX);
    prompterStubs = stubPrompter($$.SANDBOX);
  });

  afterEach(() => {
    Object.defineProperty(process, 'stdin', { value: originalStdin, configurable: true });
  });

  it('should return auth fields after successful auth', async () => {
    prompterStubs.secret.resolves(accessToken);

    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(prompterStubs.secret.callCount).to.equal(1);
    expect(stubSfCommandUxStubs.logSuccess.callCount).to.equal(1);
    expect(result).to.deep.equal(redactedAuthFields);
  });

  it('should show invalid access token provided as input', async () => {
    prompterStubs.secret.resolves('invalidaccesstokenformat');

    try {
      await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
      assert(false, 'should throw error');
    } catch (e) {
      assert(e instanceof Error);
      expect(e.message).to.include("The access token isn't in the correct format");
    }
    expect(prompterStubs.secret.callCount).to.equal(1);
  });

  it('should show that auth file already exists', async () => {
    prompterStubs.secret.resolves(accessToken);
    prompterStubs.confirm.resolves(false);
    $$.SANDBOX.stub(StateAggregator, 'getInstance').resolves({
      // @ts-expect-error because incomplete interface
      orgs: {
        exists: () => Promise.resolve(true),
      },
    });
    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(result).to.deep.equal(redactedAuthFields);
    expect(prompterStubs.secret.callCount).to.equal(1);
    expect(prompterStubs.confirm.callCount).to.equal(1);
  });

  it('should read the token piped to stdin and not prompt when auth file exists (non-TTY)', async () => {
    // Core regression for W-22954140 / GH #3573: token piped via stdin + existing auth file.
    // Drives the real stdin-reading path (no env var short-circuit).
    pipeToStdin(`${accessToken}\n`);
    $$.SANDBOX.stub(StateAggregator, 'getInstance').resolves({
      // @ts-expect-error because incomplete interface
      orgs: {
        exists: () => Promise.resolve(true),
      },
    });

    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(result).to.deep.equal(redactedAuthFields);
    // token came from stdin, not the interactive prompt
    expect(prompterStubs.secret.callCount).to.equal(0);
    // overwrite prompt skipped because stdin isn't a TTY
    expect(prompterStubs.confirm.callCount).to.equal(0);
    expect(stubSfCommandUxStubs.logSuccess.callCount).to.equal(1);
  });

  it('should trim surrounding whitespace/newlines from a piped token', async () => {
    pipeToStdin(`  ${accessToken}\n\n`);
    $$.SANDBOX.stub(StateAggregator, 'getInstance').resolves({
      // @ts-expect-error because incomplete interface
      orgs: { exists: () => Promise.resolve(false) },
    });

    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(result).to.deep.equal(redactedAuthFields);
    expect(prompterStubs.secret.callCount).to.equal(0);
  });

  it('should throw invalid-format error when stdin is empty (non-TTY)', async () => {
    pipeToStdin('');
    try {
      await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
      assert(false, 'should throw error');
    } catch (e) {
      assert(e instanceof Error);
      expect(e.message).to.include("The access token isn't in the correct format");
    }
    // never falls back to an interactive prompt
    expect(prompterStubs.secret.callCount).to.equal(0);
  });

  it('should time out (not hang) when non-TTY stdin never sends data or EOF', async () => {
    const clock = $$.SANDBOX.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const stdin = openStdin();

    const runPromise = Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    // Wait until the command has reached readPipedStdin and registered its listeners/timer,
    // then advance the fake clock past the timeout. Avoids ticking before the timer exists.
    await waitForStdinRead(stdin);
    await clock.tickAsync(60_000);

    try {
      await runPromise;
      assert(false, 'should throw error');
    } catch (e) {
      assert(e instanceof Error);
      expect(e.message).to.include('Timed out while reading the access token from stdin');
    }
    expect(prompterStubs.secret.callCount).to.equal(0);
  });

  it('should reject and clean up listeners when non-TTY stdin errors', async () => {
    const stdin = openStdin();

    const runPromise = Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    await waitForStdinRead(stdin);
    stdin.emit('error', new Error('stdin boom'));

    try {
      await runPromise;
      assert(false, 'should throw error');
    } catch (e) {
      assert(e instanceof Error);
      expect(e.message).to.include('stdin boom');
    }
    // listeners removed on cleanup so nothing dangles
    expect(stdin.listenerCount('data')).to.equal(0);
    expect(stdin.listenerCount('end')).to.equal(0);
    expect(stdin.listenerCount('error')).to.equal(0);
  });

  it('should show that auth file does not already exist', async () => {
    prompterStubs.secret.resolves(accessToken);
    $$.SANDBOX.stub(StateAggregator, 'getInstance').resolves({
      // @ts-expect-error because incomplete interface
      orgs: {
        exists: () => Promise.resolve(false),
      },
    });
    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(result).to.deep.equal(redactedAuthFields);
    expect(prompterStubs.confirm.callCount).to.equal(0);
  });

  it('should use env var SF_ACCESS_TOKEN as input to the store command', async () => {
    $$.SANDBOX.stub(env, 'getString')
      .withArgs('SF_ACCESS_TOKEN')
      .returns(accessToken)
      .withArgs('SFDX_ACCESS_TOKEN')
      // @ts-expect-error not sure why TS thinks a string is required.  getString can return undefined
      .returns(undefined);

    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(result).to.deep.equal(redactedAuthFields);
    // no prompts needed when using Env
    expect(prompterStubs.confirm.callCount).to.equal(0);
    expect(prompterStubs.secret.callCount).to.equal(0);
  });

  it('should use env var SFDX_ACCESS_TOKEN as input to the store command', async () => {
    $$.SANDBOX.stub(env, 'getString')
      .withArgs('SFDX_ACCESS_TOKEN')
      .returns(accessToken)
      .withArgs('SF_ACCESS_TOKEN')
      // @ts-expect-error not sure why TS thinks a string is required.  getString can return undefined
      .returns(undefined);

    const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com']);
    expect(result).to.deep.equal(redactedAuthFields);
    // no prompts needed when using Env
    expect(prompterStubs.confirm.callCount).to.equal(0);
    expect(prompterStubs.secret.callCount).to.equal(0);
  });

  describe('secret redaction WITH env var (SF_TEMP_SHOW_SECRETS)', () => {
    const SHOW_TOKENS_ENV = 'SF_TEMP_SHOW_SECRETS';

    beforeEach(() => {
      process.env[SHOW_TOKENS_ENV] = 'true';
      $$.SANDBOX.stub(env, 'getString').withArgs('SF_ACCESS_TOKEN').returns(accessToken);
    });

    afterEach(() => {
      delete process.env[SHOW_TOKENS_ENV];
    });

    it('shows real auth fields when env var is set', async () => {
      const result = await Store.run(['--instance-url', 'https://foo.bar.org.salesforce.com', '--no-prompt']);
      expect(result.accessToken).to.equal(accessToken);
    });
  });
});
