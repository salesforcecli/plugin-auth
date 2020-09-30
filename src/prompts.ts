/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages, Global, Mode } from '@salesforce/core';
import { UX } from '@salesforce/command';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-auth', 'messages');

export class Prompts {
  public static async shouldExitCommand(ux: UX, noPrompt?: boolean, message?: string): Promise<boolean> {
    if (noPrompt || Global.getEnvironmentMode() !== Mode.DEMO) {
      return false;
    } else {
      const answer = await ux.prompt(message || messages.getMessage('warnAuth'));
      return Prompts.answeredNo(answer);
    }
  }

  public static async shouldRunCommand(ux: UX, noPrompt?: boolean, message?: string): Promise<boolean> {
    if (noPrompt || Global.getEnvironmentMode() === Mode.DEMO) {
      return true;
    } else {
      const answer = await ux.prompt(message || messages.getMessage('warnAuth'));
      return Prompts.answeredYes(answer);
    }
  }

  private static answeredYes(answer: string): boolean {
    return ['YES', 'Y'].includes(answer.toUpperCase());
  }

  private static answeredNo(answer: string): boolean {
    return !['YES', 'Y'].includes(answer.toUpperCase());
  }
}
