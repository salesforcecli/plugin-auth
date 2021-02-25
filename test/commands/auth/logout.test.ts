/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { $$, expect, test } from '@salesforce/command/lib/test';
import { UX } from '@salesforce/command/lib/ux';
import {
  Aliases,
  AuthInfo,
  AuthInfoConfig,
  Config,
  ConfigAggregator,
  ConfigContents,
  ConfigInfo,
  Global,
  Mode,
} from '@salesforce/core';
import { MockTestOrgData } from '@salesforce/core/lib/testSetup';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { parseJson, parseJsonError } from '../../testHelper';

interface Options {
  authFiles?: string[];
  defaultUsername?: string;
  defaultDevhubUsername?: string;
  aliases?: {
    [key: string]: string;
  };
  authInfoConfigFails?: boolean;
  authInfoConfigDoesNotExist?: boolean;
}

describe('auth:logout', () => {
  const testData = new MockTestOrgData();
  const spies = new Map<string, sinon.SinonSpy>();
  let authInfoConfigStub: StubbedType<AuthInfoConfig>;

  afterEach(() => spies.clear());

  async function prepareStubs(options: Options = {}): Promise<ConfigContents> {
    const authInfo = await testData.getConfig();

    $$.SANDBOX.stub(AuthInfo, 'listAllAuthFiles').callsFake(async () => {
      if (options.authFiles) {
        return [`${authInfo.username as string}.json`].concat(options.authFiles);
      } else {
        return [`${authInfo.username as string}.json`];
      }
    });

    if (options.defaultUsername && !options.defaultDevhubUsername) {
      $$.SANDBOX.stub(ConfigAggregator.prototype, 'getInfo')
        .withArgs(Config.DEFAULT_USERNAME)
        .returns({ value: options.defaultUsername } as ConfigInfo);
      $$.SANDBOX.stub(Config.prototype, 'getKeysByValue')
        .withArgs(options.defaultUsername)
        .returns([Config.DEFAULT_USERNAME]);
    }

    if (!options.defaultUsername && options.defaultDevhubUsername) {
      $$.SANDBOX.stub(ConfigAggregator.prototype, 'getInfo')
        .withArgs(Config.DEFAULT_DEV_HUB_USERNAME)
        .returns({ value: options.defaultDevhubUsername } as ConfigInfo);
      $$.SANDBOX.stub(Config.prototype, 'getKeysByValue')
        .withArgs(options.defaultDevhubUsername)
        .returns([Config.DEFAULT_DEV_HUB_USERNAME]);
    }

    if (options.defaultUsername && options.defaultDevhubUsername) {
      $$.SANDBOX.stub(ConfigAggregator.prototype, 'getInfo')
        .withArgs(Config.DEFAULT_DEV_HUB_USERNAME)
        .returns({ value: options.defaultDevhubUsername } as ConfigInfo)
        .withArgs(Config.DEFAULT_USERNAME)
        .returns({ value: options.defaultUsername } as ConfigInfo);

      if (options.defaultUsername === options.defaultDevhubUsername) {
        $$.SANDBOX.stub(Config.prototype, 'getKeysByValue')
          .withArgs(options.defaultUsername)
          .returns([Config.DEFAULT_DEV_HUB_USERNAME, Config.DEFAULT_USERNAME]);
      } else {
        $$.SANDBOX.stub(Config.prototype, 'getKeysByValue')
          .withArgs(options.defaultUsername)
          .returns([Config.DEFAULT_DEV_HUB_USERNAME])
          .withArgs(options.defaultUsername)
          .returns([Config.DEFAULT_USERNAME]);
      }
    }

    authInfoConfigStub = stubInterface<AuthInfoConfig>($$.SANDBOX, {
      getContents: () => authInfo,
      exists: async () => !options.authInfoConfigDoesNotExist,
    });

    if (options.authInfoConfigFails) {
      stubMethod($$.SANDBOX, AuthInfoConfig, 'create').throws(new Error('failed to read file'));
    } else {
      stubMethod($$.SANDBOX, AuthInfoConfig, 'create').callsFake(async () => authInfoConfigStub);
    }

    if (options.aliases) {
      $$.setConfigStubContents('Aliases', {
        contents: { orgs: options.aliases },
      });

      const aliasesByValue = new Map<string, string>();
      Object.keys(options.aliases).forEach((key) => {
        if (options.aliases && options.aliases[key]) {
          aliasesByValue.set(options.aliases[key], key);
        }
      });

      stubMethod($$.SANDBOX, Aliases.prototype, 'getKeysByValue').callsFake((username: string) => {
        const values = aliasesByValue.get(username);
        return values ? [values] : [];
      });

      stubMethod($$.SANDBOX, Aliases.prototype, 'get').callsFake((username: string) => {
        return options.aliases ? options.aliases[username] : null;
      });
    }

    spies.set('aliasesUnset', $$.SANDBOX.spy(Aliases.prototype, 'unset'));
    spies.set('configUnset', $$.SANDBOX.spy(Config.prototype, 'unset'));
    spies.set('authInfoClearCache', $$.SANDBOX.spy(AuthInfo, 'clearCache'));

    return authInfo;
  }

  test
    .do(async () => {
      await prepareStubs({
        defaultUsername: testData.username,
        aliases: { TestAlias: testData.username },
      });
    })
    .stdout()
    .stderr()
    .command(['auth:logout', '-a', '-u', testData.username, '--json'])
    .it('should throw error when both -a and -u are specified', (ctx) => {
      const response = parseJsonError(ctx.stdout);
      expect(response.status).to.equal(1);
      expect(response.name).to.equal('SpecifiedBothUserAndAllError');
    });

  test
    .do(async () => {
      await prepareStubs({
        defaultUsername: testData.username,
        aliases: { TestAlias: testData.username },
      });
    })
    .stdout()
    .command(['auth:logout', '-p', '--json'])
    .it('should remove defaultusername when neither -a nor -u are specified', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([testData.username]);

      expect(spies.get('authInfoClearCache').callCount).to.equal(1);
      expect(spies.get('authInfoClearCache').args[0]).to.deep.equal([testData.username]);
      expect(authInfoConfigStub.unlink.callCount).to.equal(1);
      expect(spies.get('aliasesUnset').callCount).to.equal(1);
      expect(spies.get('aliasesUnset').args[0]).to.deep.equal(['TestAlias']);
      // expect the Config.unset to be called twice for the global config and local config
      expect(spies.get('configUnset').callCount).to.equal(2);
      expect(spies.get('configUnset').args[0]).to.deep.equal([Config.DEFAULT_USERNAME]);
    });

  test
    .do(async () => {
      await prepareStubs({
        defaultUsername: 'SomeOtherUser@coffee.com',
        aliases: { TestAlias: testData.username },
      });
    })
    .stdout()
    .command(['auth:logout', '-p', '-u', testData.username, '--json'])
    .it('should remove username specified by -u', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([testData.username]);

      expect(spies.get('authInfoClearCache').callCount).to.equal(1);
      expect(spies.get('authInfoClearCache').args[0]).to.deep.equal([testData.username]);
      expect(authInfoConfigStub.unlink.callCount).to.equal(1);
      expect(spies.get('aliasesUnset').callCount).to.equal(1);
      expect(spies.get('aliasesUnset').args[0]).to.deep.equal(['TestAlias']);
      // expect the Config.unset to be called zero since the
      // specified username is different that the defaultusername
      expect(spies.get('configUnset').callCount).to.equal(0);
    });

  test
    .do(async () => {
      await prepareStubs({
        authFiles: ['SomeOtherUser@coffee.com.json', 'helloworld@foobar.com.json'],
        defaultUsername: 'SomeOtherUser@coffee.com',
        aliases: {
          TestAlias: testData.username,
          TestAlias1: 'SomeOtherUser@coffee.com',
          TestAlias2: 'helloworld@foobar.com',
        },
      });
    })
    .stdout()
    .command(['auth:logout', '-p', '-a', '--json'])
    .it('should remove all usernames when -a is specified', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([testData.username, 'SomeOtherUser@coffee.com', 'helloworld@foobar.com']);

      expect(spies.get('authInfoClearCache').callCount).to.equal(3);
      expect(authInfoConfigStub.unlink.callCount).to.equal(3);
      expect(spies.get('aliasesUnset').callCount).to.equal(3);
      expect(spies.get('aliasesUnset').args).to.deep.equal([['TestAlias'], ['TestAlias1'], ['TestAlias2']]);
      // expect the Config.unset to be called twice for the global config and local config
      expect(spies.get('configUnset').callCount).to.equal(2);
    });

  test
    .do(async () => {
      await prepareStubs({
        authFiles: ['SomeOtherUser@coffee.com.json', 'helloworld@foobar.com.json'],
        defaultUsername: 'SomeOtherUser@coffee.com',
        aliases: {
          TestAlias: testData.username,
          TestAlias1: 'SomeOtherUser@coffee.com',
          TestAlias2: 'helloworld@foobar.com',
        },
      });

      $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.DEMO);
    })
    .stdout()
    .command(['auth:logout', '-p', '--json'])
    .it('should remove all usernames when in demo mode', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([testData.username, 'SomeOtherUser@coffee.com', 'helloworld@foobar.com']);

      expect(spies.get('authInfoClearCache').callCount).to.equal(3);
      expect(authInfoConfigStub.unlink.callCount).to.equal(3);
      expect(spies.get('aliasesUnset').callCount).to.equal(3);
      // expect the Config.unset to be called twice for the global config and local config
      expect(spies.get('configUnset').callCount).to.equal(2);
    });

  test
    .do(async () => {
      await prepareStubs();
    })
    .stdout()
    .stderr()
    .command(['auth:logout', '-p', '--json'])
    .it('should throw error if no defaultusername', (ctx) => {
      const response = parseJsonError(ctx.stdout);
      expect(response.status).to.equal(1);
      expect(response.name).to.equal('NoOrgFound');
    });

  test
    .do(async () => {
      await prepareStubs();
    })
    .stdout()
    .stderr()
    .command(['auth:logout', '-p', '-u', 'foobar@org.com', '--json'])
    .it('should throw error if no defaultusername and targetusername does not exist', (ctx) => {
      const response = parseJsonError(ctx.stdout);
      expect(response.status).to.equal(1);
      expect(response.name).to.equal('NoOrgFound');
    });

  test
    .do(async () => {
      await prepareStubs({ authInfoConfigFails: true });
    })
    .stdout()
    .command(['auth:logout', '-p', '-u', testData.username, '--json'])
    .it('should do nothing if it fails to create AuthInfoConfig', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([]);
    });

  test
    .do(async () => {
      await prepareStubs({
        defaultUsername: 'SomeOtherUser@coffee.com',
        aliases: { TestAlias: testData.username },
      });
      $$.SANDBOX.stub(UX.prototype, 'prompt').returns(Promise.resolve('no'));
    })
    .stdout()
    .command(['auth:logout', '-u', testData.username, '--json'])
    .it('should do nothing when prompt is answered with no', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([]);

      expect(spies.get('authInfoClearCache').callCount).to.equal(0);
      expect(authInfoConfigStub.unlink.callCount).to.equal(0);
      expect(spies.get('aliasesUnset').callCount).to.equal(0);
      expect(spies.get('configUnset').callCount).to.equal(0);
    });

  test
    .do(async () => {
      await prepareStubs({
        defaultUsername: testData.username,
        aliases: { TestAlias: testData.username },
      });
    })
    .stdout()
    .command(['auth:logout', '-p', '-u', 'TestAlias', '--json'])
    .it('should remove auth when alias is specifed', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([testData.username]);
      // expect the Config.unset to be called twice for the global config and local config
      expect(spies.get('configUnset').callCount).to.equal(2);
    });

  test
    .do(async () => {
      await prepareStubs({
        defaultUsername: 'TestAlias',
        defaultDevhubUsername: 'TestAlias',
        aliases: { TestAlias: testData.username },
      });
    })
    .stdout()
    .command(['auth:logout', '-p', '--json'])
    .it('should remove auth when defaultusername and defaultdevhubusername is alias', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([testData.username]);
      // expect callCount twice for each, 4 times total
      expect(spies.get('configUnset').callCount).to.equal(4);
      expect(spies.get('configUnset').args).to.deep.equal([
        [Config.DEFAULT_DEV_HUB_USERNAME],
        [Config.DEFAULT_USERNAME],
        [Config.DEFAULT_DEV_HUB_USERNAME],
        [Config.DEFAULT_USERNAME],
      ]);
    });

  test
    .do(async () => {
      await prepareStubs({
        defaultUsername: 'TestAlias',
        aliases: { TestAlias: testData.username },
      });
    })
    .stdout()
    .command(['auth:logout', '-p', '--json'])
    .it('should remove auth when defaultusername is alias', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([testData.username]);
      // expect the Config.unset to be called twice for the global config and local config
      expect(spies.get('configUnset').callCount).to.equal(2);
      expect(spies.get('configUnset').args[0]).to.deep.equal([Config.DEFAULT_USERNAME]);
    });

  test
    .do(async () => {
      await prepareStubs({
        defaultUsername: 'SomeOtherUser@coffee.com',
        aliases: { TestAlias: testData.username },
        authInfoConfigDoesNotExist: true,
      });
    })
    .stdout()
    .command(['auth:logout', '-p', '-u', testData.username, '--json'])
    .it('should not fail when the auth file does not exist', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([testData.username]);

      expect(spies.get('authInfoClearCache').callCount).to.equal(1);
      expect(authInfoConfigStub.unlink.callCount).to.equal(0);
      expect(spies.get('aliasesUnset').callCount).to.equal(1);
      expect(spies.get('configUnset').callCount).to.equal(0);
    });
});
