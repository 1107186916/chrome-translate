import { css, html, LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'
import { emitCtEvent } from '../utils/emit'

@customElement('ct-input')
export class CtInput extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    @unocss-placeholder;
  `

  @property({ type: String }) value = ''
  @property({ type: String }) type: 'text' | 'password' | 'number' = 'text'
  @property({ type: String }) placeholder = ''
  @property({ type: String }) label = ''
  @property({ type: String }) helpText = ''
  @property({ type: String }) error = ''
  @property({ type: Boolean }) disabled = false
  @property({ type: Boolean }) readonly = false
  @property({ type: Number }) min: number | undefined = undefined
  @property({ type: Number }) max: number | undefined = undefined
  @property({ type: Number }) step: number | undefined = undefined

  private onChange(e: Event): void {
    const value = (e.target as HTMLInputElement).value
    emitCtEvent(this, 'ct-change', { value })
  }

  private onInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value
    emitCtEvent(this, 'ct-input', { value })
  }

  override render() {
    return html`
      <label part="root" class="flex flex-col gap-4px">
        ${this.label ? html`<span part="label" class="text-12px text-[#888] font-500">${this.label}</span>` : ''}
        <input
          part="input"
          type=${this.type}
          class="px-12px py-8px border-1px border-solid border-[#ddd] rounded-[6px] text-13px text-[#333] bg-[#fafafa] outline-none transition-colors transition-duration-0.2s w-full box-border focus:border-[#00c4b6] focus:bg-[#fff] disabled:op-70 disabled:cursor-default"
          .value=${this.value}
          placeholder=${ifDefined(this.placeholder || undefined)}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          min=${ifDefined(this.min)}
          max=${ifDefined(this.max)}
          step=${ifDefined(this.step)}
          @change=${this.onChange}
          @input=${this.onInput}
        >
        ${this.helpText ? html`<span part="help" class="text-11px text-[#888]">${this.helpText}</span>` : ''}
        ${this.error ? html`<span part="error" class="text-11px text-[#e74c3c]">${this.error}</span>` : ''}
      </label>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ct-input': CtInput
  }
}
