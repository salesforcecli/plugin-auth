/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand } from '@salesforce/sf-plugins-core';
import { AuthInfo, Messages, OrgAuthorization } from '@salesforce/core';
type AuthListResult = Omit<OrgAuthorization, 'aliases'> & { alias: string };
export type AuthListResults = AuthListResult[];
Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'list');

export default class List extends SfCommand<AuthListResults> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly deprecateAliases = true;
  public static aliases = ['force:auth:list'];

  public async run(): Promise<AuthListResults> {
    try {
      const auths = await AuthInfo.listAllAuthorizations();
      if (auths.length === 0) {
        this.log(messages.getMessage('noResultsFound'));
        return [];
      }
      const mappedAuths = auths.map((auth: OrgAuthorization & { alias: string }) => {
        // core3 moved to aliases as a string[], revert to alias as a string
        auth.alias = auth.aliases ? auth.aliases.join(',') : '';

        delete auth.aliases;
        return auth;
      });
      const hasErrors = auths.filter((auth) => !!auth.error).length > 0;
      let columns = {
        alias: { header: 'ALIAS' },
        username: { header: 'USERNAME' },
        orgId: { header: 'ORG ID' },
        instanceUrl: { header: 'INSTANCE URL' },
        oauthMethod: { header: 'AUTH METHOD' },
      };
      if (hasErrors) {
        columns = { ...columns, ...{ error: { header: 'ERROR' } } };
      }
      this.styledHeader('authenticated orgs');
      this.table(mappedAuths, columns);
      return mappedAuths;
    } catch (err) {
      this.log(messages.getMessage('noResultsFound'));
      return [];
    }
  }
}
