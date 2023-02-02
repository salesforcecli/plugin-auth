/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigContents, SfdcUrl, SfError } from '@salesforce/core';
import { expect } from 'chai';
import { TestContext, uniqid } from '@salesforce/core/lib/testSetup';
import { Common } from '../src/common';

const projectSetup = async ($$: TestContext, inProject = true, contents?: ConfigContents): Promise<void> => {
  $$.inProject(inProject);
  if (inProject) {
    if (contents) {
      $$.setConfigStubContents('SfProjectJson', contents);
      if ($$.configStubs.SfProjectJson) {
        $$.configStubs.SfProjectJson.retrieveContents = async () => contents;
      }
    }
  }
};

describe('common unit tests', () => {
  const $$ = new TestContext();
  beforeEach(() => {
    // force a new id for each test so a unique project is used
    $$.id = uniqid();
  });
  describe('production url', () => {
    it('should return production URL if not in a dx project', async () => {
      await projectSetup($$, false);
      const loginUrl = await Common.resolveLoginUrl(undefined);
      expect(loginUrl).to.equal(SfdcUrl.PRODUCTION);
    });
    it('should return production URL if project with property sfdcLoginUrl absent', async () => {
      await projectSetup($$, true, {
        packageDirectories: [
          {
            path: 'force-app',
            default: true
          }
        ],
        sourceApiVersion: '50.0'
      });
      const loginUrl = await Common.resolveLoginUrl(undefined);
      expect(loginUrl).to.equal(SfdcUrl.PRODUCTION);
    });
    it('should return production URL if project with property sfdcLoginUrl present', async () => {
      await projectSetup($$, true, {
        packageDirectories: [
          {
            path: 'force-app',
            default: true
          }
        ],
        sfdcLoginUrl: 'https://login.salesforce.com',
        sourceApiVersion: '50.0'
      });
      const loginUrl = await Common.resolveLoginUrl(undefined);
      expect(loginUrl).to.equal(SfdcUrl.PRODUCTION);
    });
    it('should throw on lightning login URL in sfdcLoginUrl property', async () => {
      await projectSetup($$, true, {
        packageDirectories: [
          {
            path: 'force-app',
            default: true
          }
        ],
        sfdcLoginUrl: 'https://shanedevhub.lightning.force.com',
        sourceApiVersion: '50.0'
      });
      try {
        await Common.resolveLoginUrl(undefined);
        expect.fail('This test is failing because it is expecting an error that is never thrown');
      } catch (error) {
        const err = error as SfError;
        expect(err.name).to.equal('URL_WARNING');
      }
    });
    it('should throw on lightning login URL passed in to resolveLoginUrl()', async () => {
      await projectSetup($$, true);
      try {
        await Common.resolveLoginUrl('https://shanedevhub.lightning.force.com');
        expect.fail('This test is failing because it is expecting an error that is never thrown');
      } catch (error) {
        const err = error as SfError;
        expect(err.name).to.equal('URL_WARNING');
      }
    });
  });
  describe('custom login url', () => {
    const INSTANCE_URL_1 = 'https://example.com';
    const INSTANCE_URL_2 = 'https://some.other.com';

    it('should return custom login URL if not in a dx project and instance-url given', async () => {
      await projectSetup($$, false);
      const loginUrl = await Common.resolveLoginUrl(INSTANCE_URL_1);
      expect(loginUrl).to.equal(INSTANCE_URL_1);
    });
    it('should return custom login URL if project with property sfdcLoginUrl absent and instance-url given', async () => {
      await projectSetup($$, true, {
        contents: {
          packageDirectories: [
            {
              path: 'force-app',
              default: true
            }
          ],
          sourceApiVersion: '50.0'
        }
      });
      const loginUrl = await Common.resolveLoginUrl(INSTANCE_URL_1);
      expect(loginUrl).to.equal(INSTANCE_URL_1);
    });
    it('should return custom login URL if project with property sfdcLoginUrl present and not equal to production URL', async () => {
      await projectSetup($$, true, {
          packageDirectories: [
            {
              path: 'force-app',
              default: true
            }
          ],
          sfdcLoginUrl: INSTANCE_URL_2,
          sourceApiVersion: '50.0'
      });
      const loginUrl = await Common.resolveLoginUrl(undefined);
      expect(loginUrl).to.equal(INSTANCE_URL_2);
    });
    it('should return custom login URL 1 if project with property sfdcLoginUrl equal to ciustom url 2', async () => {
      await projectSetup($$, true, {
        contents: {
          packageDirectories: [
            {
              path: 'force-app',
              default: true
            }
          ],
          sfdcLoginUrl: INSTANCE_URL_2,
          sourceApiVersion: '50.0'
        }
      });
      const loginUrl = await Common.resolveLoginUrl(INSTANCE_URL_1);
      expect(loginUrl).to.equal(INSTANCE_URL_1);
    });
  });
});
