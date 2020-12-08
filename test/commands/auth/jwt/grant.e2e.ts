/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { exec, exec2JSON } from '@mshanemc/plugin-helpers';
import testutils = require('@mshanemc/plugin-helpers/dist/testutilsChai');
import { AuthFields } from '@salesforce/core';

const testProjectName = 'testProjectJWTGrant';
const hubName = 'prehub';
const jwtKeyFileLocation = '/Users/shane.mclaughlin/code/certificates/server2020.key';
const clientId = '3MVG9SemV5D80oBdNfh9PMfr33t6TMqG7Chw8yxOYfw9EkLa7X7yRrF7akUEFFHCc0WGI_ZgjGkKK5lpnvhsJ';

import fs = require('fs-extra');
import { expect } from 'chai';

describe('JWT Grant test', () => {
  before(async () => {
    await fs.remove(testProjectName);
    await exec(`sfdx force:project:create -n ${testProjectName}`);
    // verify that supplied hub IS jwt connected
  });

  it('creates the org, logs out, and successfully auths via jwt', async () => {
    // create the org and get the username
    const org = (await exec2JSON(
      `sfdx force:org:create -f config/project-scratch-def.json -v ${hubName} -a ${testProjectName} --json`,
      { cwd: testProjectName }
    )) as OrgCreateResult;
    expect(org.status).to.equal(0);
    expect(org.result.username).to.be.a('string');

    // get the instanceUrl from force:org:display
    const displayResult = (await exec2JSON(`sfdx force:org:display -u ${org.result.username} --json`, {
      cwd: testProjectName,
    })) as OrgDisplayResult;
    expect(displayResult.status).to.equal(0);
    // logout
    await exec(`sfdx auth:logout -u ${org.result.username} -p`, { cwd: testProjectName });
    // reconnect via jwt:grant
    const grantResult = (await exec2JSON(
      `sfdx auth:jwt:grant -f ${jwtKeyFileLocation} -u ${org.result.username} -i ${clientId} --instanceurl ${displayResult.result.instanceUrl} -s --json`,
      { cwd: testProjectName }
    )) as GrantComandResult;
    // console.log(grantResult);
    expect(grantResult.status).to.equal(0);
  });

  after(async () => {
    await testutils.orgDelete(testProjectName);
    await fs.remove(testProjectName);
  });
});

interface SfdxCommandResponse {
  status: number;
}

interface OrgCreateResult extends SfdxCommandResponse {
  result: {
    orgId: string;
    username: string;
  };
}

interface OrgDisplayResult extends SfdxCommandResponse {
  result: {
    instanceUrl: 'string';
  };
}
interface GrantComandResult extends SfdxCommandResponse {
  result: AuthFields;
}
