/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, Global, Mode } from '@salesforce/core';
import { UX } from '@salesforce/command';
import * as chalk from 'chalk';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

function dimMessage(message: string): string {
  return chalk.dim(message);
}

export class Prompts {
  public static async shouldExitCommand(ux: UX, noPrompt?: boolean, message?: string): Promise<boolean> {
    if (noPrompt || Global.getEnvironmentMode() !== Mode.DEMO) {
      return false;
    } else {
      const msg = dimMessage(message || messages.getMessage('warnAuth'));
      const answer = await ux.prompt(msg);
      return Prompts.answeredNo(answer);
    }
  }

  public static async shouldRunCommand(ux: UX, noPrompt?: boolean, message?: string): Promise<boolean> {
    if (noPrompt || Global.getEnvironmentMode() === Mode.DEMO) {
      return true;
    } else {
      const msg = dimMessage(message || messages.getMessage('warnAuth'));
      const answer = await ux.prompt(msg);
      return Prompts.answeredYes(answer);
    }
  }

  public static async askForClientSecret(ux: UX, disableMasking = false): Promise<string> {
    return Prompts.askForHiddenResponse(ux, 'clientSecretStdin', disableMasking);
  }

  public static async askForAccessToken(ux: UX, disableMasking = false): Promise<string> {
    return Prompts.askForHiddenResponse(ux, 'accessTokenStdin', disableMasking);
  }

  public static async askOverwriteAuthFile(ux: UX, username: string): Promise<boolean> {
    const yN = await ux.prompt(messages.getMessage('overwriteAccessTokenAuthUserFile', [username]), {
      type: 'normal',
      default: 'y',
    });
    return Prompts.answeredYes(yN);
  }
  private static async askForHiddenResponse(ux: UX, messageKey: string, disableMasking = false): Promise<string> {
    const msg = dimMessage(messages.getMessage(messageKey));
    return ux.prompt(msg, {
      type: disableMasking ? 'normal' : 'hide',
    });
  }

  private static answeredYes(answer: string): boolean {
    return ['YES', 'Y'].includes(answer.toUpperCase());
  }

  private static answeredNo(answer: string): boolean {
    return !['YES', 'Y'].includes(answer.toUpperCase());
  }
}
