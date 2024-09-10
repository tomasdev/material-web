/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  html,
  LitElement,
  nothing,
  PropertyValues,
  render,
  TemplateResult,
} from 'lit';
import {property, query, queryAssignedElements, state} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';

import {EASING} from '../../internal/motion/animation.js';

/**
 * A field component.
 */
export class Field extends LitElement {
  @property({type: Boolean}) disabled = false;
  @property({type: Boolean}) error = false;
  @property({type: Boolean}) focused = false;
  @property() label = '';
  @property({type: Boolean, attribute: 'no-asterisk'}) noAsterisk = false;
  @property({type: Boolean}) populated = false;
  @property({type: Boolean}) required = false;
  @property({type: Boolean}) resizable = false;
  @property({attribute: 'supporting-text'}) supportingText = '';
  @property({attribute: 'error-text'}) errorText = '';
  @property({type: Number}) count = -1;
  @property({type: Number}) max = -1;

  /**
   * Whether or not the field has leading content.
   */
  @property({type: Boolean, attribute: 'has-start'}) hasStart = false;

  /**
   * Whether or not the field has trailing content.
   */
  @property({type: Boolean, attribute: 'has-end'}) hasEnd = false;

  @queryAssignedElements({slot: 'aria-describedby'})
  private readonly slottedAriaDescribedBy!: HTMLElement[];

  private get counterText() {
    // Count and max are typed as number, but can be set to null when Lit removes
    // their attributes. These getters coerce back to a number for calculations.
    const countAsNumber = this.count ?? -1;
    const maxAsNumber = this.max ?? -1;
    // Counter does not show if count is negative, or max is negative or 0.
    if (countAsNumber < 0 || maxAsNumber <= 0) {
      return '';
    }

    return `${countAsNumber} / ${maxAsNumber}`;
  }

  private get supportingOrErrorText() {
    return this.error && this.errorText ? this.errorText : this.supportingText;
  }

  @state() private isAnimating = false;
  private labelAnimation?: Animation;
  /**
   * When set to true, the error text's `role="alert"` will be removed, then
   * re-added after an animation frame. This will re-announce an error message
   * to screen readers.
   */
  @state() private refreshErrorAlert = false;
  @state() private disableTransitions = false;
  @query('.label.floating')
  private readonly floatingLabelEl!: HTMLElement | null;
  @query('.label.resting') private readonly restingLabelEl!: HTMLElement | null;
  @query('.container') private readonly containerEl!: HTMLElement | null;

  /**
   * Re-announces the field's error supporting text to screen readers.
   *
   * Error text announces to screen readers anytime it is visible and changes.
   * Use the method to re-announce the message when the text has not changed,
   * but announcement is still needed (such as for `reportValidity()`).
   */
  reannounceError() {
    this.refreshErrorAlert = true;
  }

  protected override update(props: PropertyValues<Field>) {
    // Client-side property updates
    const isDisabledChanging =
      props.has('disabled') && props.get('disabled') !== undefined;
    if (isDisabledChanging) {
      this.disableTransitions = true;
    }

    // When disabling, remove focus styles if focused.
    if (this.disabled && this.focused) {
      props.set('focused', true);
      this.focused = false;
    }

    // Animate if focused or populated change.
    this.animateLabelIfNeeded({
      wasFocused: props.get('focused'),
      wasPopulated: props.get('populated'),
    });

    super.update(props);
  }

  protected override render() {
    const floatingLabel = this.renderLabel(/*isFloating*/ true);
    const restingLabel = this.renderLabel(/*isFloating*/ false);
    const outline = this.renderOutline?.(floatingLabel);
    const classes = {
      'disabled': this.disabled,
      'disable-transitions': this.disableTransitions,
      'error': this.error && !this.disabled,
      'focused': this.focused,
      'with-start': this.hasStart,
      'with-end': this.hasEnd,
      'populated': this.populated,
      'resizable': this.resizable,
      'required': this.required,
      'no-label': !this.label,
    };

    return html`
      <div class="field ${classMap(classes)}">
        <div class="container-overflow">
          <slot name="container"></slot>
          ${this.renderBackground?.()} ${this.renderIndicator?.()} ${outline}
          <div class="container">
            <div class="start">
              <slot name="start"></slot>
            </div>
            <div class="middle">
              <div class="label-wrapper">
                ${restingLabel} ${outline ? nothing : floatingLabel}
              </div>
              <div class="content">
                <slot></slot>
              </div>
            </div>
            <div class="end">
              <slot name="end"></slot>
            </div>
          </div>
        </div>
        ${this.renderSupportingText()}
      </div>
    `;
  }

  protected override updated(changed: PropertyValues<Field>) {
    if (
      changed.has('supportingText') ||
      changed.has('errorText') ||
      changed.has('count') ||
      changed.has('max')
    ) {
      this.updateSlottedAriaDescribedBy();
    }

    if (this.refreshErrorAlert) {
      // The past render cycle removed the role="alert" from the error message.
      // Re-add it after an animation frame to re-announce the error.
      requestAnimationFrame(() => {
        this.refreshErrorAlert = false;
      });
    }

    if (this.disableTransitions) {
      requestAnimationFrame(() => {
        this.disableTransitions = false;
      });
    }
  }

  protected renderBackground?(): TemplateResult;
  protected renderIndicator?(): TemplateResult;
  protected renderOutline?(floatingLabel: unknown): TemplateResult;

  private renderSupportingText() {
    const {supportingOrErrorText, counterText} = this;
    if (!supportingOrErrorText && !counterText) {
      return nothing;
    }

    // Always render the supporting text span so that our `space-around`
    // container puts the counter at the end.
    const start = html`<span>${supportingOrErrorText}</span>`;
    // Conditionally render counter so we don't render the extra `gap`.
    // TODO(b/244473435): add aria-label and announcements
    const end = counterText
      ? html`<span class="counter">${counterText}</span>`
      : nothing;

    // Announce if there is an error and error text visible.
    // If refreshErrorAlert is true, do not announce. This will remove the
    // role="alert" attribute. Another render cycle will happen after an
    // animation frame to re-add the role.
    const shouldErrorAnnounce =
      this.error && this.errorText && !this.refreshErrorAlert;
    const role = shouldErrorAnnounce ? 'alert' : nothing;
    return html`
      <div class="supporting-text" role=${role}>${start}${end}</div>
      <slot
        name="aria-describedby"
        @slotchange=${this.updateSlottedAriaDescribedBy}></slot>
    `;
  }

  private updateSlottedAriaDescribedBy() {
    for (const element of this.slottedAriaDescribedBy) {
      render(html`${this.supportingOrErrorText} ${this.counterText}`, element);
      element.setAttribute('hidden', '');
    }
  }

  private renderLabel(isFloating: boolean) {
    if (!this.label) {
      return nothing;
    }

    let visible: boolean;
    if (isFloating) {
      // Floating label is visible when focused/populated or when animating.
      visible = this.focused || this.populated || this.isAnimating;
    } else {
      // Resting label is visible when unfocused. It is never visible while
      // animating.
      visible = !this.focused && !this.populated && !this.isAnimating;
    }

    const classes = {
      'hidden': !visible,
      'floating': isFloating,
      'resting': !isFloating,
    };

    // Add '*' if a label is present and the field is required
    const labelText = `${this.label}${
      this.required && !this.noAsterisk ? '*' : ''
    }`;

    return html`
      <span class="label ${classMap(classes)}" aria-hidden=${!visible}
        >${labelText}</span
      >
    `;
  }

  private animateLabelIfNeeded({
    wasFocused,
    wasPopulated,
  }: {
    wasFocused?: boolean;
    wasPopulated?: boolean;
  }) {
    if (!this.label) {
      return;
    }

    wasFocused ??= this.focused;
    wasPopulated ??= this.populated;
    const wasFloating = wasFocused || wasPopulated;
    const shouldBeFloating = this.focused || this.populated;
    if (wasFloating === shouldBeFloating) {
      return;
    }

    this.isAnimating = true;
    this.labelAnimation?.cancel();

    // Only one label is visible at a time for clearer text rendering.
    // The floating label is visible and used during animation. At the end of
    // the animation, it will either remain visible (if floating) or hide and
    // the resting label will be shown.
    //
    // We don't use forward filling because if the dimensions of the text field
    // change (leading icon removed, density changes, etc), then the animation
    // will be inaccurate.
    //
    // Re-calculating the animation each time will prevent any visual glitches
    // from appearing.
    // TODO(b/241113345): use animation tokens
    this.labelAnimation = this.floatingLabelEl?.animate(
      this.getLabelKeyframes(),
      {duration: 150, easing: EASING.STANDARD},
    );

    this.labelAnimation?.addEventListener('finish', () => {
      // At the end of the animation, update the visible label.
      this.isAnimating = false;
    });
  }

  private getLabelKeyframes() {
    const {floatingLabelEl, restingLabelEl} = this;
    if (!floatingLabelEl || !restingLabelEl) {
      return [];
    }

    const {
      x: floatingX,
      y: floatingY,
      height: floatingHeight,
    } = floatingLabelEl.getBoundingClientRect();
    const {
      x: restingX,
      y: restingY,
      height: restingHeight,
    } = restingLabelEl.getBoundingClientRect();
    const floatingScrollWidth = floatingLabelEl.scrollWidth;
    const restingScrollWidth = restingLabelEl.scrollWidth;
    // Scale by width ratio instead of font size since letter-spacing will scale
    // incorrectly. Using the width we can better approximate the adjusted
    // scale and compensate for tracking and overflow.
    // (use scrollWidth instead of width to account for clipped labels)
    const scale = restingScrollWidth / floatingScrollWidth;
    const xDelta = restingX - floatingX;
    // The line-height of the resting and floating label are different. When
    // we move the floating label down to the resting label's position, it won't
    // exactly match because of this. We need to adjust by half of what the
    // final scaled floating label's height will be.
    const yDelta =
      restingY -
      floatingY +
      Math.round((restingHeight - floatingHeight * scale) / 2);

    // Create the two transforms: floating to resting (using the calculations
    // above), and resting to floating (re-setting the transform to initial
    // values).
    const restTransform = `translateX(${xDelta}px) translateY(${yDelta}px) scale(${scale})`;
    const floatTransform = `translateX(0) translateY(0) scale(1)`;

    // Constrain the floating labels width to a scaled percentage of the
    // resting label's width. This will prevent long clipped labels from
    // overflowing the container.
    const restingClientWidth = restingLabelEl.clientWidth;
    const isRestingClipped = restingScrollWidth > restingClientWidth;
    const width = isRestingClipped ? `${restingClientWidth / scale}px` : '';
    if (this.focused || this.populated) {
      return [
        {transform: restTransform, width},
        {transform: floatTransform, width},
      ];
    }

    return [
      {transform: floatTransform, width},
      {transform: restTransform, width},
    ];
  }

  getSurfacePositionClientRect() {
    return this.containerEl!.getBoundingClientRect();
  }
}
