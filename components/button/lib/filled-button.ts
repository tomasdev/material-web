/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {Button} from './button';

/**
 * @soyCompatible
 */
export class FilledButton extends Button {
  /** @soyCompatible */
  protected override getRenderClasses() {
    return {
      ...super.getRenderClasses(),
      'mdc-button--filled': true,
    };
  }
}
