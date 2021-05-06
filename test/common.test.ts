/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdcUrl, SfdxProject, SfdxError } from '@salesforce/core';
import sinon = require('sinon');
import { expect } from '@salesforce/command/lib/test';
import { restoreContext, testSetup } from '@salesforce/core/lib/testSetup';
import { Common } from '../src/common';

describe('common unit tests', () => {
  const sandbox = sinon.createSandbox();
  const $$ = testSetup();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let projectPath: string;
  beforeEach(async () => {
    projectPath = await $$.localPathRetriever($$.id);
  });
  afterEach(() => {
    restoreContext($$);
    sandbox.restore();
  });
  describe('production url', () => {
    it('should return production URL if not in a dx project', async () => {
      sandbox.stub(SfdxProject, 'resolve').throwsException();
      const loginUrl = await Common.resolveLoginUrl(undefined);
      expect(loginUrl).to.equal(SfdcUrl.PRODUCTION);
      expect(projectPath).to.be.ok;
    });
    it('should return production URL if project with property sfdcLoginUrl absent', async () => {
      sandbox.stub(SfdxProject.prototype, 'resolveProjectConfig').resolves({
        packageDirectories: [
          {
            path: 'force-app',
            default: true,
          },
        ],
        sourceApiVersion: '50.0',
      });
      const loginUrl = await Common.resolveLoginUrl(undefined);
      expect(loginUrl).to.equal(SfdcUrl.PRODUCTION);
    });
    it('should return production URL if project with property sfdcLoginUrl present', async () => {
      sandbox.stub(SfdxProject.prototype, 'resolveProjectConfig').resolves({
        packageDirectories: [
          {
            path: 'force-app',
            default: true,
          },
        ],
        sfdcLoginUrl: SfdcUrl.PRODUCTION,
        sourceApiVersion: '50.0',
      });
      const loginUrl = await Common.resolveLoginUrl(undefined);
      expect(loginUrl).to.equal(SfdcUrl.PRODUCTION);
    });
    it('should throw on lightning login URL in sfdcLoginUrl property', async () => {
      sandbox.stub(SfdxProject.prototype, 'resolveProjectConfig').resolves({
        packageDirectories: [
          {
            path: 'force-app',
            default: true,
          },
        ],
        sfdcLoginUrl: 'https://shanedevhub.lightning.force.com',
        sourceApiVersion: '50.0',
      });
      try {
        await Common.resolveLoginUrl(undefined);
        sinon.assert.fail('This test is failing because it is expecting an error that is never thrown');
      } catch (error) {
        const err = error as SfdxError;
        expect(err.name).to.equal('URL_WARNING');
      }
    });
    it('should throw on lightning login URL passed in to resolveLoginUrl()', async () => {
      try {
        await Common.resolveLoginUrl('https://shanedevhub.lightning.force.com');
        sinon.assert.fail('This test is failing because it is expecting an error that is never thrown');
      } catch (error) {
        const err = error as SfdxError;
        expect(err.name).to.equal('URL_WARNING');
      }
    });
  });
  describe('custom login url', () => {
    const INSTANCE_URL_1 = 'https://example.com';
    const INSTANCE_URL_2 = 'https://some.other.com';

    it('should return custom login URL if not in a dx project and instanceurl given', async () => {
      sandbox.stub(SfdxProject, 'resolve').throwsException();
      const loginUrl = await Common.resolveLoginUrl(INSTANCE_URL_1);
      expect(loginUrl).to.equal(INSTANCE_URL_1);
    });
    it('should return custom login URL if project with property sfdcLoginUrl absent and instanceurl given', async () => {
      sandbox.stub(SfdxProject.prototype, 'resolveProjectConfig').resolves({
        packageDirectories: [
          {
            path: 'force-app',
            default: true,
          },
        ],
        sourceApiVersion: '50.0',
      });
      const loginUrl = await Common.resolveLoginUrl(INSTANCE_URL_1);
      expect(loginUrl).to.equal(INSTANCE_URL_1);
    });
    it('should return custom login URL if project with property sfdcLoginUrl present and not equal to production URL', async () => {
      sandbox.stub(SfdxProject.prototype, 'resolveProjectConfig').resolves({
        packageDirectories: [
          {
            path: 'force-app',
            default: true,
          },
        ],
        sfdcLoginUrl: INSTANCE_URL_2,
        sourceApiVersion: '50.0',
      });
      const loginUrl = await Common.resolveLoginUrl(undefined);
      expect(loginUrl).to.equal(INSTANCE_URL_2);
    });
    it('should return custom login URL 1 if project with property sfdcLoginUrl equal to custom url 2', async () => {
      sandbox.stub(SfdxProject.prototype, 'resolveProjectConfig').resolves({
        packageDirectories: [
          {
            path: 'force-app',
            default: true,
          },
        ],
        sfdcLoginUrl: INSTANCE_URL_2,
        sourceApiVersion: '50.0',
      });
      const loginUrl = await Common.resolveLoginUrl(INSTANCE_URL_1);
      expect(loginUrl).to.equal(INSTANCE_URL_1);
    });
  });
});
