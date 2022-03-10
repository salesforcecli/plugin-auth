/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { $$, expect, test } from '@salesforce/command/lib/test';
import { UX } from '@salesforce/command/lib/ux';
import { AuthRemover, ConfigContents, Global, Mode, SfOrg, SfOrgs } from '@salesforce/core';
import { MockTestOrgData } from '@salesforce/core/lib/testSetup';
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

  let authRemoverSpy: sinon.SinonSpy;

  async function prepareStubs(options: Options = {}): Promise<ConfigContents> {
    const authInfo = await testData.getConfig();

    authRemoverSpy = $$.SANDBOX.spy(AuthRemover.prototype, 'removeAuth');

    if (options.defaultUsername) {
      $$.SANDBOX.stub(AuthRemover.prototype, 'findAuth').resolves({
        username: testData.username,
      } as SfOrg);
    } else {
      $$.SANDBOX.stub(AuthRemover.prototype, 'findAuth').throws('NoOrgFound');
    }

    $$.SANDBOX.stub(AuthRemover.prototype, 'findAllAuths').returns(options.aliases as unknown as SfOrgs);

    return authInfo;
  }

  test
    .do(async () => {
      await prepareStubs();
    })
    .stdout()
    .stderr()
    .command(['auth:logout', '-a', '-u', testData.username, '--json'])
    .it('should throw error when both -a and -u are specified', (ctx) => {
      const response = parseJsonError(ctx.stdout);
      expect(response.status).to.equal(1);
      expect(response.name).to.equal('SpecifiedBothUserAndAll');
    });

  test
    .do(async () => {
      await prepareStubs({ defaultUsername: testData.username });
    })
    .stdout()
    .command(['auth:logout', '-p', '--json'])
    .it('should remove defaultusername when neither -a nor -u are specified', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);

      // eslint-disable-next-line no-console
      console.log('res', response);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([testData.username]);
      expect(authRemoverSpy.callCount).to.equal(1);
    });

  test
    .do(async () => {
      await prepareStubs({ defaultUsername: testData.username });
    })
    .stdout()
    .command(['auth:logout', '-p', '-u', testData.username, '--json'])
    .it('should remove username specified by -u', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([testData.username]);
      expect(authRemoverSpy.callCount).to.equal(1);
    });

  test
    .do(async () => {
      await prepareStubs({
        aliases: {
          [testData.username]: 'TestAlias',
          'SomeOtherUser@coffee.com': 'TestAlias1',
          'helloworld@foobar.com': 'TestAlias2',
        },
      });
    })
    .stdout()
    .command(['auth:logout', '-p', '-a', '--json'])
    .it('should remove all usernames when -a is specified', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([testData.username, 'SomeOtherUser@coffee.com', 'helloworld@foobar.com']);
      expect(authRemoverSpy.callCount).to.equal(3);
    });

  test
    .do(async () => {
      await prepareStubs({
        defaultUsername: 'SomeOtherUser@coffee.com',
        aliases: {
          [testData.username]: 'TestAlias',
          'SomeOtherUser@coffee.com': 'TestAlias1',
          'helloworld@foobar.com': 'TestAlias2',
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
      expect(authRemoverSpy.callCount).to.equal(3);
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
      expect(authRemoverSpy.callCount).to.equal(0);
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
      await prepareStubs({
        defaultUsername: 'SomeOtherUser@coffee.com',
        aliases: { TestAlias: testData.username },
      });
      $$.SANDBOX.stub(UX.prototype, 'prompt').resolves('no');
    })
    .stdout()
    .command(['auth:logout', '-u', testData.username, '--json'])
    .it('should do nothing when prompt is answered with no', (ctx) => {
      const response = parseJson<string[]>(ctx.stdout);
      expect(response.status).to.equal(0);
      expect(response.result).to.deep.equal([]);
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
    });
});
