/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AuthInfo, OrgAuthorization, Messages } from '@salesforce/core';
import { CliUx } from '@oclif/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'list');

export default class List extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static aliases = ['force:auth:list'];

  public static readonly flagsConfig: FlagsConfig = {};
  public async run(): Promise<OrgAuthorization[]> {
    try {
      const auths = await AuthInfo.listAllAuthorizations();
      if (auths.length === 0) {
        this.ux.log(messages.getMessage('noResultsFound'));
        return [];
      }
      auths.map((auth: OrgAuthorization & { alias: string }) => {
        // core3 moved to aliases as a string[], revert to alias as a string
        auth.alias = auth.aliases.join(',');
        // to prevent 'undefined' entries in the table only delete auth.alias if it's json output
        // matches the previous behavior where alias was only present when it was defined
        if (auth.alias === '' && this.flags.json) delete auth.alias;

        delete auth.aliases;
      });
      const hasErrors = auths.filter((auth) => !!auth.error).length > 0;
      let columns: CliUx.Table.table.Columns<Record<string, unknown>> = {
        alias: { header: 'ALIAS' },
        username: { header: 'USERNAME' },
        orgId: { header: 'ORG ID' },
        instanceUrl: { header: 'INSTANCE URL' },
        oauthMethod: { header: 'AUTH METHOD' },
      };
      if (hasErrors) {
        columns = { ...columns, ...{ error: { header: 'ERROR' } } };
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
