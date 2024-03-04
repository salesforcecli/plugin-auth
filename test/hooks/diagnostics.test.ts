/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import util from 'node:util';
import fs from 'node:fs';
import { expect } from 'chai';
import { fromStub, StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { SfDoctor } from '@salesforce/plugin-info';
import { Lifecycle, Messages } from '@salesforce/core';
import { TestContext } from '@salesforce/core/lib/testSetup.js';
import { hook } from '../../src/hooks/diagnostics.js';

const pluginName = '@salesforce/plugin-auth';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(pluginName, 'diagnostics');

describe('Doctor diagnostics', () => {
  const sandbox = new TestContext().SANDBOX;

  const key64 = '3e33abf2880f9ce618108343e98298183e33abf2880f9ce618108343e9829818';
  const key32 = '3e33abf2880f9ce618108343e9829818';

  const sfCryptoV2Orig = process.env.SF_CRYPTO_V2;
  const genericKeychainOrig = process.env.SF_USE_GENERIC_UNIX_KEYCHAIN;

  let doctorMock: SfDoctor;
  let doctorStubbedType: StubbedType<SfDoctor>;
  let addPluginDataStub: sinon.SinonStub;
  let addSuggestionStub: sinon.SinonStub;
  let lifecycleEmitStub: sinon.SinonStub;

  beforeEach(() => {
    doctorStubbedType = stubInterface<SfDoctor>(sandbox, {
      getDiagnosis: () => ({
        cliConfig: { root: 'rootPath', dataDir: 'dataDir/path' },
        versionDetail: {
          pluginVersions: ['my-plugin 3.3.17 (link) /Users/me/dev/my-plugin'],
        },
      }),
    });
    doctorMock = fromStub(doctorStubbedType);
    lifecycleEmitStub = stubMethod(sandbox, Lifecycle.prototype, 'emit');

    // Shortening these for brevity in tests.
    addPluginDataStub = doctorStubbedType.addPluginData;
    addSuggestionStub = doctorStubbedType.addSuggestion;
  });

  afterEach(() => {
    if (sfCryptoV2Orig !== undefined) {
      process.env.SF_CRYPTO_V2 = sfCryptoV2Orig;
    } else {
      delete process.env.SF_CRYPTO_V2;
    }
    if (genericKeychainOrig !== undefined) {
      process.env.SF_USE_GENERIC_UNIX_KEYCHAIN = genericKeychainOrig;
    } else {
      delete process.env.SF_USE_GENERIC_UNIX_KEYCHAIN;
    }
    sandbox.restore();
  });

  it('should warn when CLI does not support v2 crypto', async () => {
    sandbox.stub(util, 'promisify').returns(() => ({ stdout: JSON.stringify([{ version: '6.5.0' }]) }));
    process.env.SF_USE_GENERIC_UNIX_KEYCHAIN = 'false';

    await hook({ doctor: doctorMock });

    expect(addPluginDataStub.callCount, 'Expected doctor.addPluginData() to be called once').to.equal(1);
    expect(addPluginDataStub.args[0][0]).to.equal(pluginName);
    // The generic keychain is used on Windows necessarily, so expect true rather
    // than using the value of process.env.SF_USE_GENERIC_UNIX_KEYCHAIN
    expect(addPluginDataStub.args[0][1]).to.deep.equal({
      isUsingGenericKeychain: process.platform === 'win32' || false,
      sfCryptoV2Support: false,
      cryptoVersion: 'unknown',
      sfCryptoV2: undefined,
    });
    expect(addSuggestionStub.callCount, 'Expected doctor.addSuggestion() to be called once').to.equal(1);
    expect(addSuggestionStub.args[0][0]).to.equal(messages.getMessage('sfCryptoV2Support'));
    expect(lifecycleEmitStub.called).to.be.true;
    expect(lifecycleEmitStub.args[0][0]).to.equal('Doctor:diagnostic');
    expect(lifecycleEmitStub.args[0][1]).to.deep.equal({
      testName: `[${pluginName}] CLI supports v2 crypto`,
      status: 'warn',
    });
  });

  it('should pass when CLI supports v2 crypto', async () => {
    sandbox.stub(util, 'promisify').returns(() => ({ stdout: JSON.stringify([{ version: '6.7.0' }]) }));
    process.env.SF_USE_GENERIC_UNIX_KEYCHAIN = 'false';
    await hook({ doctor: doctorMock });

    expect(addPluginDataStub.callCount, 'Expected doctor.addPluginData() to be called once').to.equal(1);
    expect(addPluginDataStub.args[0][0]).to.equal(pluginName);
    // The generic keychain is used on Windows necessarily, so expect true rather
    // than using the value of process.env.SF_USE_GENERIC_UNIX_KEYCHAIN
    expect(addPluginDataStub.args[0][1]).to.deep.equal({
      isUsingGenericKeychain: process.platform === 'win32' || false,
      sfCryptoV2Support: true,
      cryptoVersion: 'unknown',
      sfCryptoV2: undefined,
    });
    expect(addSuggestionStub.callCount, 'Expected doctor.addSuggestion() NOT to be called').to.equal(0);
    expect(lifecycleEmitStub.called).to.be.true;
    expect(lifecycleEmitStub.args[0][0]).to.equal('Doctor:diagnostic');
    expect(lifecycleEmitStub.args[0][1]).to.deep.equal({
      testName: `[${pluginName}] CLI supports v2 crypto`,
      status: 'pass',
    });
  });

  it('should fail when v2 crypto is used without v2 crypto CLI support', async () => {
    sandbox.stub(util, 'promisify').returns(() => ({ stdout: JSON.stringify([{ version: '6.5.0' }]) }));
    process.env.SF_USE_GENERIC_UNIX_KEYCHAIN = 'true';
    sandbox.stub(fs, 'readFileSync').returns(JSON.stringify({ key: key64 }));

    await hook({ doctor: doctorMock });

    expect(addPluginDataStub.callCount, 'Expected doctor.addPluginData() to be called once').to.equal(1);
    expect(addPluginDataStub.args[0][0]).to.equal(pluginName);
    expect(addPluginDataStub.args[0][1]).to.deep.equal({
      isUsingGenericKeychain: true,
      sfCryptoV2Support: false,
      cryptoVersion: 'v2',
      sfCryptoV2: undefined,
    });
    expect(addSuggestionStub.callCount, 'Expected doctor.addSuggestion() to be called twice').to.equal(2);
    expect(addSuggestionStub.args[0][0]).to.equal(messages.getMessage('sfCryptoV2Support'));
    expect(lifecycleEmitStub.called).to.be.true;
    expect(lifecycleEmitStub.args[0][0]).to.equal('Doctor:diagnostic');
    expect(lifecycleEmitStub.args[0][1]).to.deep.equal({
      testName: `[${pluginName}] CLI supports v2 crypto`,
      status: 'warn',
    });
    expect(addSuggestionStub.args[1][0]).to.equal(messages.getMessage('sfCryptoV2Unstable'));
    expect(lifecycleEmitStub.args[1][0]).to.equal('Doctor:diagnostic');
    expect(lifecycleEmitStub.args[1][1]).to.deep.equal({
      testName: `[${pluginName}] CLI using stable v2 crypto`,
      status: 'fail',
    });
  });

  it('should pass when v2 crypto is used with v2 crypto CLI support', async () => {
    sandbox.stub(util, 'promisify').returns(() => ({ stdout: JSON.stringify([{ version: '6.7.0' }]) }));
    process.env.SF_USE_GENERIC_UNIX_KEYCHAIN = 'true';
    sandbox.stub(fs, 'readFileSync').returns(JSON.stringify({ key: key64 }));

    await hook({ doctor: doctorMock });

    expect(addPluginDataStub.callCount, 'Expected doctor.addPluginData() to be called once').to.equal(1);
    expect(addPluginDataStub.args[0][0]).to.equal(pluginName);
    expect(addPluginDataStub.args[0][1]).to.deep.equal({
      isUsingGenericKeychain: true,
      sfCryptoV2Support: true,
      cryptoVersion: 'v2',
      sfCryptoV2: undefined,
    });
    expect(addSuggestionStub.callCount, 'Expected doctor.addSuggestion() NOT to be called').to.equal(0);
    expect(lifecycleEmitStub.callCount, 'Expected Lifecycle.emit() to be called twice').to.equal(2);
    expect(lifecycleEmitStub.args[0][0]).to.equal('Doctor:diagnostic');
    expect(lifecycleEmitStub.args[0][1]).to.deep.equal({
      testName: `[${pluginName}] CLI supports v2 crypto`,
      status: 'pass',
    });
    expect(lifecycleEmitStub.args[1][0]).to.equal('Doctor:diagnostic');
    expect(lifecycleEmitStub.args[1][1]).to.deep.equal({
      testName: `[${pluginName}] CLI using stable v2 crypto`,
      status: 'pass',
    });
  });

  it('should warn when (known) v1 crypto is used with SF_CRYPTO_V2=true and v2 crypto CLI support', async () => {
    sandbox.stub(util, 'promisify').returns(() => ({ stdout: JSON.stringify([{ version: '6.7.0' }]) }));
    process.env.SF_USE_GENERIC_UNIX_KEYCHAIN = 'true';
    process.env.SF_CRYPTO_V2 = 'true';
    sandbox.stub(fs, 'readFileSync').returns(JSON.stringify({ key: key32 }));

    await hook({ doctor: doctorMock });

    expect(addPluginDataStub.callCount, 'Expected doctor.addPluginData() to be called once').to.equal(1);
    expect(addPluginDataStub.args[0][0]).to.equal(pluginName);
    expect(addPluginDataStub.args[0][1]).to.deep.equal({
      isUsingGenericKeychain: true,
      sfCryptoV2Support: true,
      cryptoVersion: 'v1',
      sfCryptoV2: 'true',
    });
    expect(addSuggestionStub.callCount, 'Expected doctor.addSuggestion() to be called once').to.equal(1);
    expect(addSuggestionStub.args[0][0]).to.equal(messages.getMessage('sfCryptoV2Desired'));
    expect(lifecycleEmitStub.called).to.be.true;
    expect(lifecycleEmitStub.args[1][0]).to.equal('Doctor:diagnostic');
    expect(lifecycleEmitStub.args[1][1]).to.deep.equal({
      testName: `[${pluginName}] CLI using stable v1 crypto`,
      status: 'warn',
    });
  });

  it('should pass when (known) v1 crypto is used without SF_CRYPTO_V2', async () => {
    sandbox.stub(util, 'promisify').returns(() => ({ stdout: JSON.stringify([{ version: '6.7.0' }]) }));
    process.env.SF_USE_GENERIC_UNIX_KEYCHAIN = 'true';
    sandbox.stub(fs, 'readFileSync').returns(JSON.stringify({ key: key32 }));

    await hook({ doctor: doctorMock });

    expect(addPluginDataStub.callCount, 'Expected doctor.addPluginData() to be called once').to.equal(1);
    expect(addPluginDataStub.args[0][0]).to.equal(pluginName);
    expect(addPluginDataStub.args[0][1]).to.deep.equal({
      isUsingGenericKeychain: true,
      sfCryptoV2Support: true,
      cryptoVersion: 'v1',
      sfCryptoV2: undefined,
    });
    expect(addSuggestionStub.callCount, 'Expected doctor.addSuggestion() NOT to be called').to.equal(0);
    expect(lifecycleEmitStub.callCount, 'Expected Lifecycle.emit() to be called twice').to.equal(2);
    expect(lifecycleEmitStub.args[0][0]).to.equal('Doctor:diagnostic');
    expect(lifecycleEmitStub.args[0][1]).to.deep.equal({
      testName: `[${pluginName}] CLI supports v2 crypto`,
      status: 'pass',
    });
    expect(lifecycleEmitStub.args[1][0]).to.equal('Doctor:diagnostic');
    expect(lifecycleEmitStub.args[1][1]).to.deep.equal({
      testName: `[${pluginName}] CLI using stable v1 crypto`,
      status: 'pass',
    });
  });
});
