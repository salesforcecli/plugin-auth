/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { loglevel, SfCommand } from '@salesforce/sf-plugins-core';
import { AuthInfo, Messages, OrgAuthorization } from '@salesforce/core';
type AuthListResult = Omit<OrgAuthorization, 'aliases'> & { alias: string };
export type AuthListResults = AuthListResult[];
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'list');

export default class ListAuth extends SfCommand<AuthListResults> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly deprecateAliases = true;
  public static readonly aliases = ['force:auth:list', 'auth:list'];

  public static readonly flags = {
    loglevel,
  };

  public async run(): Promise<AuthListResults> {
    await this.parse(ListAuth);
    try {
      const auths = await AuthInfo.listAllAuthorizations();
      if (auths.length === 0) {
        this.log(messages.getMessage('noResultsFound'));
        return [];
      }
      const mappedAuths: AuthListResults = auths.map((auth: OrgAuthorization) => {
        const { aliases, ...rest } = auth;
        // core3 moved to aliases as a string[], revert to alias as a string
        return { ...rest, alias: aliases ? aliases.join(',') : '' };
      });

      const hasErrors = auths.filter((auth) => !!auth.error).length > 0;
      this.table({
        data: mappedAuths.map((auth) => ({
          ALIAS: auth.alias,
          USERNAME: auth.username,
          'ORG ID': auth.orgId,
          'INSTANCE URL': auth.instanceUrl,
          'AUTH METHOD': auth.oauthMethod,
          ...(hasErrors ? { error: { header: 'ERROR' } } : {}),
        })),
        title: 'authenticated orgs',
      });
      return mappedAuths;
    } catch (err) {
      this.log(messages.getMessage('noResultsFound'));
      return [];
    }
  }
}
