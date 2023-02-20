/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import {
  AuthInfo,
  AuthRemover,
  ConfigAggregator,
  Global,
  Messages,
  Mode,
  OrgAuthorization,
  OrgConfigProperties,
} from '@salesforce/core';
import { Flags, loglevel } from '@salesforce/sf-plugins-core';
import { Interfaces } from '@oclif/core';
import { Separator } from 'inquirer';
import * as chalk from 'chalk';
import { AuthBaseCommand } from '../../authBaseCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'logout');
const commonMessages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');
type choice = { name: string; value: OrgAuthorization };

export type AuthLogoutResults = string[];

export default class Logout extends AuthBaseCommand<AuthLogoutResults> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly deprecateAliases = true;
  public static aliases = ['force:auth:logout', 'auth:logout'];

  public static readonly flags = {
    'target-org': Flags.string({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
      aliases: ['targetusername', 'u'],
      deprecateAliases: true,
    }),
    all: Flags.boolean({
      char: 'a',
      summary: messages.getMessage('flags.all.summary'),
      description: messages.getMessage('flags.all.description'),
      required: false,
      default: false,
      exclusive: ['target-org'],
    }),
    'no-prompt': Flags.boolean({
      char: 'p',
      summary: commonMessages.getMessage('flags.no-prompt.summary'),
      required: false,
      deprecateAliases: true,
      aliases: ['noprompt'],
    }),
    loglevel,
  };

  private flags: Interfaces.InferredFlags<typeof Logout.flags>;

  private static buildChoices(orgAuths: OrgAuthorization[], all: boolean): Array<choice | Separator> {
    const maxUsernameLength = Math.max('Username'.length, ...orgAuths.map((orgAuth) => orgAuth.username.length));
    const maxAliasLength = Math.max(
      'Aliases'.length,
      ...orgAuths.map((orgAuth) => (orgAuth.aliases ? orgAuth.aliases.join(',') : '').length)
    );
    const maxConfigLength = Math.max(
      'Configs'.length,
      ...orgAuths.map((orgAuth) => (orgAuth.configs ? orgAuth.configs.join(',') : '').length)
    );
    const maxTypeLength = Math.max(
      'Type'.length,
      ...orgAuths.map((orgAuth) => {
        if (orgAuth.isScratchOrg) {
          return 'Scratch'.length;
        }
        if (orgAuth.isDevHub) {
          return 'DevHub'.length;
        }
        if (orgAuth.isSandbox) {
          return 'Sandbox'.length;
        }
        return 0;
      })
    );
    const choices = orgAuths
      .map((orgAuth) => {
        const aliasString = (orgAuth.aliases ? orgAuth.aliases.join(',') : '').padEnd(maxAliasLength, ' ');
        const configString = (orgAuth.configs ? orgAuth.configs.join(',') : '').padEnd(maxConfigLength, ' ');
        const typeString = chalk.dim(
          (orgAuth.isScratchOrg ? 'Scratch' : orgAuth.isDevHub ? 'DevHub' : orgAuth.isSandbox ? 'Sandbox' : '').padEnd(
            maxTypeLength,
            ' '
          )
        );
        // username - aliases - configs
        const key = `${chalk.bold(
          orgAuth.username.padEnd(maxUsernameLength)
        )} | ${typeString} | ${aliasString} | ${chalk.yellowBright(configString)}`;
        return { name: key, value: orgAuth, checked: all, short: `${os.EOL}${orgAuth.username}` };
      })
      .sort((a, b) => a.value.username.localeCompare(b.value.username));
    const userHeader = `${'Username'.padEnd(maxUsernameLength, ' ')}`;
    const aliasHeader = `${'Aliases'.padEnd(maxAliasLength, ' ')}`;
    const configHeader = `${'Configs'.padEnd(maxConfigLength, ' ')}`;
    const typeHeader = `${'Type'.padEnd(maxTypeLength, ' ')}`;
    return [new Separator(`  ${userHeader} | ${typeHeader} | ${aliasHeader} | ${configHeader}`), ...choices];
  }

  public async run(): Promise<AuthLogoutResults> {
    const { flags } = await this.parse(Logout);
    this.flags = flags;
    this.configAggregator = await ConfigAggregator.create();
    const remover = await AuthRemover.create();
    let orgAuths: OrgAuthorization[] = [];
    const targetUsername =
      this.flags['target-org'] ?? (this.configAggregator.getInfo(OrgConfigProperties.TARGET_ORG).value as string);

    // if no-prompt, there must be a resolved target-org or --all
    if (flags['no-prompt'] && !targetUsername && !flags.all) {
      throw messages.createError('noOrgSpecifiedWithNoPrompt');
    }

    if (this.shouldFindAllAuths(targetUsername)) {
      orgAuths = await AuthInfo.listAllAuthorizations();
    } else if (targetUsername) {
      orgAuths = await AuthInfo.listAllAuthorizations(
        (orgAuth) => orgAuth.username === targetUsername || !!orgAuth.aliases?.includes(targetUsername)
      );
    } else {
      // just for clarity
      orgAuths = [];
    }

    if (orgAuths.length === 0) {
      if (this.flags['target-org']) {
        // user specified a target org but it was not resolved, issue success message and return
        this.logSuccess(messages.getMessage('logoutOrgCommandSuccess', [this.flags['target-org']]));
        return [this.flags['target-org']];
      }
      this.info(messages.getMessage('noOrgsFound'));
      return [];
    }

    const { orgs, confirmed } = await this.promptForOrgsToRemove(orgAuths, flags.all);

    if (confirmed) {
      for (const org of orgs) {
        // run sequentially to avoid configFile concurrency issues
        // eslint-disable-next-line no-await-in-loop
        await remover.removeAuth(org.username);
      }
      const loggedOutUsernames = orgs.map((org) => org.username);
      this.logSuccess(messages.getMessage('logoutOrgCommandSuccess', [loggedOutUsernames.join(os.EOL)]));
      return loggedOutUsernames;
    } else {
      this.info(messages.getMessage('noOrgsSelected'));
      return [];
    }
  }

  private shouldFindAllAuths(targetUsername: string | undefined): boolean {
    if (targetUsername && !this.flags.all) {
      return false;
    }
    return this.flags.all || Global.getEnvironmentMode() === Mode.DEMO || !this.flags['no-prompt'];
  }

  private async promptForOrgsToRemove(
    orgAuths: OrgAuthorization[],
    all: boolean
  ): Promise<{ orgs: OrgAuthorization[]; confirmed: boolean }> {
    if (this.flags['no-prompt']) {
      return { orgs: orgAuths, confirmed: true };
    }

    if (orgAuths.length === 1) {
      if (await this.confirm(messages.getMessage('prompt.confirm.single', [orgAuths[0].username]), 10000, false)) {
        return { orgs: orgAuths, confirmed: true };
      } else {
        return { orgs: [], confirmed: false };
      }
    }

    // pick the orgs to delete - if this.flags.all - set each org to selected
    // otherwise prompt the user to select the orgs to delete
    const choices = Logout.buildChoices(orgAuths, all);
    const { orgs, confirmed } = await this.timedPrompt<{ orgs: OrgAuthorization[]; confirmed: boolean }>([
      {
        name: 'orgs',
        message: messages.getMessage('prompt.select-envs'),
        type: 'checkbox',
        choices,
        loop: true,
      },
      {
        name: 'confirmed',
        when: (answers): boolean => answers.orgs.length > 0,
        message: (answers): string => {
          this.log(messages.getMessage('warning'));
          const names = answers.orgs.map((org) => org.username);
          if (names.length === orgAuths.length) {
            return messages.getMessage('prompt.confirm-all');
          } else {
            return messages.getMessage('prompt.confirm', [names.length, names.length > 1 ? 's' : '']);
          }
        },
        type: 'confirm',
        default: false,
      },
    ]);
    return {
      orgs: orgs.map((a) => a),
      confirmed,
    };
  }
}
