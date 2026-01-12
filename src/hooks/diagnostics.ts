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
import childProcess from 'node:child_process';
import { ExecOptions, PromiseWithChild } from 'node:child_process';
import util from 'node:util';
import { join } from 'node:path';
import fs from 'node:fs';
import { Global, Lifecycle, Logger, Messages } from '@salesforce/core';
import { SfDoctor, SfDoctorDiagnosis } from '@salesforce/plugin-info';
import { asString, isString } from '@salesforce/ts-types';
import { parseJsonMap } from '@salesforce/kit';

type HookFunction = (options: { doctor: SfDoctor }) => Promise<[void]>;
type PromisifiedExec = (command: string, options?: ExecOptions) => PromiseWithChild<{ stdout: string; stderr: string }>;

let logger: Logger;
const getLogger = (): Logger => {
  if (!logger) {
    logger = Logger.childFromRoot('plugin-auth-diagnostics');
  }
  return logger;
};

const pluginName = '@salesforce/plugin-auth';
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(pluginName, 'diagnostics');

let exec: PromisifiedExec;

export const hook: HookFunction = async (options) => {
  getLogger().debug(`Running SfDoctor diagnostics for ${pluginName}`);
  exec = util.promisify(childProcess.exec);
  try {
    await exec('npm -v');
    return await Promise.all([cryptoVersionTest(options.doctor)]);
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : isString(e) ? e : 'unknown';
    getLogger().warn(`Unable to run SfDoctor diagnostics for ${pluginName} due to: ${errMsg}`);
    return Promise.resolve([undefined]);
  }
};

type NpmExplanationDeps = {
  type: string;
  name: string;
  spec: string;
  from: NpmExplanation;
};
type NpmExplanation = {
  name: string;
  version: string;
  location: string;
  isWorkspace: string;
  dependents: NpmExplanationDeps[];
};

// ============================
// ***   DIAGNOSTIC TESTS   ***
// ============================

// Detects if the auth key used is crypto v1 or v2
// Detects if the SF_CRYPTO_V2 env var is set and if it matches the key crypto version
const cryptoVersionTest = async (doctor: SfDoctor): Promise<void> => {
  getLogger().debug('Running Crypto Version tests');

  const sfCryptoV2Support = await supportsCliV2Crypto(doctor);
  let cryptoVersion: 'unknown' | 'v1' | 'v2' = 'unknown';

  const sfCryptoV2 = process.env.SF_CRYPTO_V2;

  const isUsingGenericKeychain =
    process.platform === 'win32' ||
    process.env.SF_USE_GENERIC_UNIX_KEYCHAIN?.toLowerCase() === 'true' ||
    process.env.USE_GENERIC_UNIX_KEYCHAIN?.toLowerCase() === 'true';

  // If the CLI is using key.json, we can read the file and get the key length
  // to discover the crypto version being used. If not, then we can't detect it.
  if (isUsingGenericKeychain) {
    try {
      const keyFile = join(Global.DIR, 'key.json');
      const key = asString(parseJsonMap(fs.readFileSync(keyFile, 'utf8'))?.key);
      cryptoVersion = key?.length === 64 ? 'v2' : key?.length === 32 ? 'v1' : 'unknown';
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : isString(e) ? e : 'unknown';
      getLogger().debug(`Could not detect key size due to:\n${errMsg}`);
    }
  }

  doctor.addPluginData(pluginName, {
    sfCryptoV2,
    isUsingGenericKeychain,
    sfCryptoV2Support,
    cryptoVersion,
  });

  const testName1 = `[${pluginName}] CLI supports v2 crypto`;
  let status1 = 'pass';
  if (!sfCryptoV2Support) {
    status1 = 'fail';
    doctor.addSuggestion(messages.getMessage('sfCryptoV2Support'));
  }
  void Lifecycle.getInstance().emit('Doctor:diagnostic', { testName: testName1, status: status1 });

  // Only do this test if we know they are using v2 crypto
  if (cryptoVersion === 'v2') {
    const testName2 = `[${pluginName}] CLI using stable v2 crypto`;
    let status2 = 'pass';
    if (!sfCryptoV2Support) {
      status2 = 'fail';
      doctor.addSuggestion(messages.getMessage('sfCryptoV2Unstable'));
    }
    void Lifecycle.getInstance().emit('Doctor:diagnostic', { testName: testName2, status: status2 });
  }

  // Only do this test if we know they are using v1 crypto
  if (cryptoVersion === 'v1') {
    const testName3 = `[${pluginName}] CLI using stable v1 crypto`;
    let status3 = 'pass';
    if (sfCryptoV2?.toLowerCase() === 'true') {
      // They have SF_CRYPTO_V2=true but are using v1 crypto. They might not know this
      // or know how to generate a v2 key.
      if (sfCryptoV2Support) {
        status3 = 'warn';
        doctor.addSuggestion(messages.getMessage('sfCryptoV2Desired'));
      }
    }
    void Lifecycle.getInstance().emit('Doctor:diagnostic', { testName: testName3, status: status3 });
  }
};

// Inspect CLI install and plugins to ensure all versions of `@salesforce/core` can support v2 crypto.
// This uses `npm explain @salesforce/core` to ensure all versions are greater than 6.6.0.
const supportsCliV2Crypto = async (doctor: SfDoctor): Promise<boolean> => {
  const diagnosis: SfDoctorDiagnosis = doctor.getDiagnosis();
  let coreSupportsV2 = false;
  let pluginsSupportV2 = false;
  let linksSupportsV2 = false;

  const { root, dataDir } = diagnosis.cliConfig;
  // check core CLI
  if (root?.length) {
    try {
      const { stdout } = await exec('npm explain @salesforce/core --json', { cwd: root });
      const coreExplanation = JSON.parse(stdout) as NpmExplanation[];
      coreSupportsV2 = coreExplanation.every((exp) => exp?.version > '6.6.0');
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : isString(e) ? e : 'unknown';
      getLogger().debug(`Cannot determine CLI v2 crypto core support due to: ${errMsg}`);
    }
  }
  // check installed plugins
  if (dataDir?.length) {
    try {
      const { stdout } = await exec('npm explain @salesforce/core --json', { cwd: dataDir });
      const pluginsExplanation = JSON.parse(stdout) as NpmExplanation[];
      pluginsSupportV2 = pluginsExplanation?.length ? pluginsExplanation.every((exp) => exp?.version > '6.6.0') : true;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : isString(e) ? e : 'unknown';
      if (errMsg.includes('No dependencies found matching @salesforce/core')) {
        pluginsSupportV2 = true;
      } else {
        getLogger().debug(`Cannot determine CLI v2 crypto installed plugins support due to: ${errMsg}`);
      }
    }
  }
  // check linked plugins
  const pluginVersions = diagnosis?.versionDetail?.pluginVersions;
  const linkedPlugins = pluginVersions.filter((pv) => pv.includes('(link)'));
  if (linkedPlugins?.length) {
    try {
      const coreVersionChecks = await Promise.all(
        linkedPlugins.map(async (pluginEntry) => {
          // last entry is the path. E.g., "auth 3.3.17 (link) /Users/me/dev/plugin-auth",
          const pluginPath = pluginEntry.split(' ')?.pop();
          if (pluginPath?.length) {
            const { stdout } = await exec('npm explain @salesforce/core --json', { cwd: pluginPath });
            const linksExplanation = JSON.parse(stdout) as NpmExplanation[];
            return linksExplanation?.every((exp) => exp?.version > '6.6.0');
          }
          return true;
        })
      );
      linksSupportsV2 = !coreVersionChecks.includes(false);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : isString(e) ? e : 'unknown';
      getLogger().debug(`Cannot determine CLI v2 crypto linked plugins support due to: ${errMsg}`);
    }
  } else {
    linksSupportsV2 = true;
  }

  return coreSupportsV2 && pluginsSupportV2 && linksSupportsV2;
};
