/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthInfo, Authorization, Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'list');

export default class List extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static aliases = ['force:auth:list'];

  public static readonly flagsConfig: FlagsConfig = {};
  public async run(): Promise<Authorization[]> {
    try {
      const auths = await AuthInfo.listAllAuthorizations();
      const hasErrors = auths.filter((auth) => !!auth.error).length > 0;
      const columns = ['alias', 'username', 'orgId', 'instanceUrl', 'oauthMethod'];
      if (hasErrors) {
        columns.push('error');
      }
      this.ux.styledHeader('authenticated orgs');
      this.ux.table(auths, columns);
      return auths;
    } catch (err) {
      this.ux.log(messages.getMessage('noResultsFound'));
      return [];
    }
  }
}
