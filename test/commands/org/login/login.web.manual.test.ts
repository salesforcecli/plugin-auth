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

import { expect } from 'chai';
import sinon from 'sinon';
import { AuthInfo, SfError, WebOAuthServer } from '@salesforce/core';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { SfCommand, stubSfCommandUx } from '@salesforce/sf-plugins-core';
import LoginWeb from '../../../../src/commands/org/login/web.js';

const redirectUri = 'http://localhost:1717/OauthRedirect';

describe('org:login:web --manual', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  let uxStubs: ReturnType<typeof stubSfCommandUx>;
  let secretPrompt: sinon.SinonStub;
  let authInfoCreate: sinon.SinonStub;
  let exchangedCode: string | undefined;
  let authInfo: { save: sinon.SinonStub; handleAliasAndDefaultSettings: sinon.SinonStub; getFields: sinon.SinonStub };

  /** Reads the printed authorization URL so a test can craft a callback with the matching state. */
  const printedAuthUrl = (): URL => {
    const line = uxStubs.log.args.map((a) => a[0]).find((l) => typeof l === 'string' && l.startsWith('https://'));
    expect(line, 'authorization URL should be printed').to.be.a('string');
    return new URL(line as string);
  };

  const validCallback = (code = 'aPrxCode'): string =>
    `${redirectUri}?code=${code}&state=${printedAuthUrl().searchParams.get('state') ?? ''}`;

  const runAndCatch = async (args: string[] = ['--manual']): Promise<SfError> => {
    try {
      await LoginWeb.run(args);
    } catch (err) {
      return err as SfError;
    }
    throw new Error('expected command to throw');
  };

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    uxStubs = stubSfCommandUx($$.SANDBOX);
    secretPrompt = $$.SANDBOX.stub(SfCommand.prototype, 'secretPrompt');
    $$.SANDBOX.stub(WebOAuthServer, 'determineOauthPort').resolves(1717);
    authInfo = {
      save: $$.SANDBOX.stub().resolves(),
      handleAliasAndDefaultSettings: $$.SANDBOX.stub().resolves(),
      getFields: $$.SANDBOX.stub().returns({
        username: testOrg.username,
        orgId: testOrg.orgId,
        instanceUrl: testOrg.instanceUrl,
        accessToken: 'ACCESS',
        refreshToken: 'REFRESH',
      }),
    };
    exchangedCode = undefined;
    authInfoCreate = $$.SANDBOX.stub(AuthInfo, 'create').callsFake(async (options?: AuthInfo.Options) => {
      // the command clears authCode after the exchange, so capture it at call time
      exchangedCode = options?.oauth2Options?.authCode;
      return authInfo as unknown as AuthInfo;
    });
    $$.SANDBOX.stub(AuthInfo, 'identifyPossibleScratchOrgs').resolves();
  });

  afterEach(() => {
    $$.restore();
  });

  it('prints the authorization URL, exchanges the pasted code and saves the auth with alias and defaults', async () => {
    secretPrompt.callsFake(async () => validCallback('theCode'));
    const result = await LoginWeb.run(['--manual', '--alias', 'dev', '--set-default']);

    const authUrl = printedAuthUrl();
    expect(authUrl.origin).to.equal('https://login.salesforce.com');
    expect(authUrl.searchParams.get('code_challenge')).to.have.length(43);
    expect(authUrl.searchParams.get('redirect_uri')).to.equal(redirectUri);

    expect(authInfoCreate.calledOnce).to.be.true;
    const options = authInfoCreate.firstCall.args[0] as AuthInfo.Options;
    expect(exchangedCode).to.equal('theCode');
    expect(options.oauth2Options?.authCode, 'auth code is cleared after the exchange').to.be.undefined;
    expect(options.oauth2Options?.clientId).to.equal('PlatformCLI');
    expect(options.oauth2Options?.redirectUri).to.equal(redirectUri);
    expect(options.oauth2, 'the OAuth2 instance holding the PKCE verifier must be reused').to.exist;

    expect(authInfo.save.calledOnce).to.be.true;
    const settings = authInfo.handleAliasAndDefaultSettings.firstCall.args[0] as Record<string, unknown>;
    expect(settings).to.include({ alias: 'dev', setDefault: true });
    expect(settings.setDefaultDevHub).to.not.be.ok;
    expect(uxStubs.logSuccess.firstCall.args[0]).to.include(testOrg.username);
    expect(result.username).to.equal(testOrg.username);
    expect(result.accessToken).to.include('[REDACTED]');
    expect(result.refreshToken).to.be.undefined;
  });

  it('never echoes the pasted callback URL, tokens or the PKCE verifier', async () => {
    secretPrompt.callsFake(async () => validCallback('secretCode'));
    await LoginWeb.run(['--manual']);
    const verifier = (authInfoCreate.firstCall.args[0] as { oauth2: { codeVerifier: string } }).oauth2.codeVerifier;
    const everything = [...uxStubs.log.args, ...uxStubs.logSuccess.args, ...uxStubs.warn.args]
      .map((a) => (typeof a[0] === 'string' ? a[0] : JSON.stringify(a[0])))
      .join('\n');
    expect(everything).to.not.include('secretCode');
    expect(everything).to.not.include(verifier);
    expect(everything).to.not.include('ACCESS');
    expect(everything).to.not.include('REFRESH');
  });

  it('works in container mode, where the browser flow is rejected', async () => {
    process.env.SF_CONTAINER_MODE = 'true';
    try {
      secretPrompt.callsFake(async () => validCallback());
      await LoginWeb.run(['--manual']);
      expect(authInfo.save.calledOnce).to.be.true;
    } finally {
      delete process.env.SF_CONTAINER_MODE;
    }
  });

  it('uses --instance-url, --client-id with its secret and --scopes', async () => {
    secretPrompt.onFirstCall().resolves('clientSecret');
    secretPrompt.onSecondCall().callsFake(async () => validCallback());
    await LoginWeb.run([
      '--manual',
      '--instance-url',
      'https://test.salesforce.com',
      '--client-id',
      'MyApp',
      '--scopes',
      'api sfap_api',
    ]);
    const authUrl = printedAuthUrl();
    expect(authUrl.origin).to.equal('https://test.salesforce.com');
    expect(authUrl.searchParams.get('client_id')).to.equal('MyApp');
    expect(authUrl.searchParams.get('scope')).to.equal('api sfap_api');
    const options = (authInfoCreate.firstCall.args[0] as AuthInfo.Options).oauth2Options;
    expect(options?.loginUrl).to.equal('https://test.salesforce.com/');
    expect(options?.clientSecret).to.equal('clientSecret');
  });

  it('rejects a callback whose state does not match and does not exchange anything', async () => {
    secretPrompt.resolves(`${redirectUri}?code=x&state=${'f'.repeat(64)}`);
    expect((await runAndCatch()).name).to.equal('StateMismatchError');
    expect(authInfoCreate.called).to.be.false;
  });

  it('rejects a callback without a code', async () => {
    secretPrompt.callsFake(async () => `${redirectUri}?state=${printedAuthUrl().searchParams.get('state') ?? ''}`);
    expect((await runAndCatch()).name).to.equal('MissingAuthCodeError');
    expect(authInfoCreate.called).to.be.false;
  });

  it('reports an OAuth error response from Salesforce', async () => {
    secretPrompt.callsFake(
      async () =>
        `${redirectUri}?error=access_denied&error_description=user+said+no&state=${
          printedAuthUrl().searchParams.get('state') ?? ''
        }`
    );
    const err = await runAndCatch();
    expect(err.name).to.equal('OAuthError');
    expect(err.message).to.include('user said no');
    expect(authInfoCreate.called).to.be.false;
  });

  it('rejects a malformed paste', async () => {
    secretPrompt.resolves('code=abc');
    expect((await runAndCatch()).name).to.equal('MalformedCallbackUrlError');
  });

  it('explains a replayed or expired authorization code and clears the code', async () => {
    secretPrompt.callsFake(async () => validCallback());
    authInfoCreate.rejects(
      SfError.create({ name: 'AuthCodeExchangeError', message: 'invalid_grant: expired authorization code' })
    );
    const err = await runAndCatch();
    expect(err.name).to.equal('ManualAuthCodeExchangeError');
    expect(err.message).to.include('single use');
    expect(err.message).to.include('expired authorization code');
    expect((authInfoCreate.firstCall.args[0] as AuthInfo.Options).oauth2Options?.authCode).to.be.undefined;
    expect(authInfo.save.called).to.be.false;
  });

  it('fails with a timeout error when the prompt times out', async () => {
    $$.SANDBOX.stub(WebOAuthServer, 'getAuthTimeout').returns(300_000);
    secretPrompt.rejects(new Error('Prompt timed out.'));
    const err = await runAndCatch();
    expect(err.name).to.equal('ManualTimeoutError');
    expect(err.message).to.include('300 seconds');
    expect(secretPrompt.firstCall.args[0]).to.deep.include({ ms: 300_000 });
    expect(authInfoCreate.called).to.be.false;
  });

  it('rethrows unexpected prompt failures instead of reporting a timeout', async () => {
    secretPrompt.rejects(new Error('stdin closed'));
    const err = await runAndCatch();
    expect(err.message).to.include('stdin closed');
    expect(err.name).to.not.equal('ManualTimeoutError');
  });

  it('fails with a cancellation error when the user aborts the prompt', async () => {
    secretPrompt.rejects(Object.assign(new Error('User force closed the prompt'), { name: 'ExitPromptError' }));
    expect((await runAndCatch()).name).to.equal('ManualCancelledError');
    expect(authInfoCreate.called).to.be.false;
  });

  it('rejects --json before printing anything, because the hidden prompt writes to stdout', async () => {
    const err = await runAndCatch(['--manual', '--json']);
    expect(err.name).to.equal('ManualJsonNotSupportedError');
    expect(secretPrompt.called).to.be.false;
    expect(uxStubs.log.called).to.be.false;
  });

  it('cannot be combined with --browser or --client-app', async () => {
    expect((await runAndCatch(['--manual', '--browser', 'chrome'])).message).to.include('--browser');
    expect(
      (await runAndCatch(['--manual', '--client-app', 'MyApp', '--username', 'me@example.com'])).message
    ).to.include('--client-app');
    expect(secretPrompt.called).to.be.false;
  });
});
