import { GM_getValue, GM_setValue } from '$'
import { css, html, LitElement, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { Translator } from '../core/translator'
import { ChromeTranslator } from '../core/provider/chrome'
import { emitCtEvent } from '../utils/emit'
import { LANGUAGES } from '../utils/languages'
import { STORAGE_CONFIG_KEY } from '../utils/constant'
import { LFUCache } from '../utils/LFUCache'
import './ct-select'
import './ct-textarea'
import './ct-button'

interface PanelConfig {
  language: { from: string; to: string }
}

@customElement('chrome-translate-panel')
export class ChromeTranslatePanel extends LitElement {
  static override styles = css`
    :host {
      all: initial;
      display: contents;
    }

    .ct-panel-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
      z-index: 999999998;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    .ct-panel-overlay.open {
      opacity: 1;
      pointer-events: auto;
    }

    .ct-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 380px;
      max-width: 90vw;
      height: 100vh;
      background: #fff;
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
      z-index: 999999999;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    }
    .ct-panel.open {
      transform: translateX(0);
    }

    .ct-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #eee;
      flex-shrink: 0;
    }

    .ct-panel-title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .ct-panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ct-panel-lang-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ct-panel-swap {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: #f0f0f0;
      color: #555;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
      padding: 0;
    }
    .ct-panel-swap:hover:not(:disabled) {
      background: #00c4b6;
      color: #fff;
    }
    .ct-panel-swap:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .ct-panel-actions {
      display: flex;
      gap: 8px;
    }

    .ct-panel-btn {
      flex: 1;
      height: 36px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.15s;
      font-weight: 500;
    }
    .ct-panel-btn-primary {
      background: #00c4b6;
      color: #fff;
    }
    .ct-panel-btn-primary:hover:not(:disabled) {
      background: #00a89a;
    }
    .ct-panel-btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .ct-panel-btn-secondary {
      background: #f0f0f0;
      color: #555;
      flex: 0.5;
    }
    .ct-panel-btn-secondary:hover {
      background: #e0e0e0;
    }

    .ct-panel-error {
      color: #e74c3c;
      font-size: 13px;
      padding: 4px 0;
    }

    .ct-panel-output-wrap {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }

    .ct-panel-output-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #f5f5f5;
      font-size: 12px;
      color: #888;
    }

    .ct-panel-copy {
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #888;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      padding: 0;
    }
    .ct-panel-copy:hover {
      background: #e8e8e8;
      color: #333;
    }

    .ct-panel-output {
      padding: 12px;
      font-size: 14px;
      line-height: 1.6;
      color: #222;
      word-break: break-word;
      white-space: pre-wrap;
      min-height: 40px;
    }

    .ct-panel-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #e0e0e0;
      border-top-color: #00c4b6;
      border-radius: 50%;
      animation: ct-panel-spin 0.6s linear infinite;
      flex-shrink: 0;
    }

    @keyframes ct-panel-spin {
      to { transform: rotate(360deg); }
    }
  `

  @state() private open = false
  @state() private inputText = ''
  @state() private outputText = ''
  @state() private loading = false
  @state() private error = ''
  @state() private language = { from: 'auto' as string, to: '' as string }

  private translator = (() => {
    const t = new Translator()
    t.registerProvider('chrome', new ChromeTranslator())
    return t
  })()
  private cache = new LFUCache<string>('ct-input-cache')

  private get fromOptions() {
    return [{ label: 'Auto', value: 'auto' }, ...LANGUAGES]
  }

  private get toOptions() {
    return [...LANGUAGES]
  }

  override connectedCallback(): void {
    super.connectedCallback()
    const config = GM_getValue<PanelConfig>(STORAGE_CONFIG_KEY, {
      language: { from: 'auto', to: '' },
    })
    this.language = {
      from: config.language.from || 'auto',
      to: config.language.to || navigator.languages[0],
    }
    document.addEventListener('chrome-translate-open-panel', this.onOpenPanel)
    document.addEventListener('keydown', this.onKeydown)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    document.removeEventListener('chrome-translate-open-panel', this.onOpenPanel)
    document.removeEventListener('keydown', this.onKeydown)
  }

  private onOpenPanel = (): void => {
    this.open = true
  }

  private closePanel(): void {
    this.open = false
    this.inputText = ''
    this.outputText = ''
    this.error = ''
  }

  private onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open) {
      this.closePanel()
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && this.open) {
      this.onTranslate()
    }
  }

  private swapLanguages(): void {
    if (this.language.from === 'auto') return
    const temp = this.language.from
    this.language.from = this.language.to
    this.language.to = temp
    this.syncConfig()
  }

  private syncConfig(): void {
    GM_setValue(STORAGE_CONFIG_KEY, {
      ...GM_getValue(STORAGE_CONFIG_KEY, {}),
      language: this.language,
    })
    emitCtEvent(this, 'chrome-translate-language-change', {
      from: this.language.from,
      to: this.language.to,
    })
  }

  private onLanguageFromChange(e: CustomEvent): void {
    this.language = { ...this.language, from: e.detail.value }
    this.syncConfig()
  }

  private onLanguageToChange(e: CustomEvent): void {
    this.language = { ...this.language, to: e.detail.value }
    this.syncConfig()
  }

  private onInputChange(e: CustomEvent): void {
    this.inputText = e.detail.value
  }

  private async onTranslate(): Promise<void> {
    const text = this.inputText.trim()
    if (!text) return

    if (!(window as any).Translator?.availability) {
      this.error = 'Translator API is not available (Chrome 138+ required)'
      return
    }

    const from = this.language.from
    const to = this.language.to

    if (from !== 'auto' && from === to) {
      this.error = 'Source and target languages are the same'
      return
    }

    this.loading = true
    this.error = ''
    this.outputText = ''

    try {
      let sourceLang = from
      if (sourceLang === 'auto') {
        sourceLang = await this.translator.detectLanguage(text)
      }

      const cacheKey = `${sourceLang}:${to}:${text}`
      const cached = this.cache.get(cacheKey)
      if (cached) {
        this.outputText = cached
        return
      }

      const provider = this.translator.getProvider('chrome')
      if (!provider) {
        this.error = 'Translation service unavailable'
        return
      }

      const result = await provider.translate({
        from: sourceLang,
        to,
        text,
      })

      if (result) {
        this.cache.set(cacheKey, result)
        this.outputText = result
      }
    } catch (e: any) {
      this.error = e.message || 'Translation failed'
    } finally {
      this.loading = false
    }
  }

  private onClear(): void {
    this.inputText = ''
    this.outputText = ''
    this.error = ''
  }

  private async onCopy(): Promise<void> {
    if (!this.outputText) return
    try {
      await navigator.clipboard.writeText(this.outputText)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = this.outputText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }

  override render() {
    return html`
      <div class="ct-panel-overlay ${this.open ? 'open' : ''}" @click=${this.closePanel}></div>
      <div class="ct-panel ${this.open ? 'open' : ''}">
        <div class="ct-panel-header">
          <span class="ct-panel-title">Translate</span>
          <ct-button size="sm" variant="ghost" square @click=${this.closePanel}>✕</ct-button>
        </div>

        <div class="ct-panel-body">
          <!-- Language selectors -->
          <div class="ct-panel-lang-row">
            <div style="flex:1">
              <ct-select
                .value=${this.language.from}
                .options=${this.fromOptions}
                @ct-change=${this.onLanguageFromChange}
              ></ct-select>
            </div>
            <button
              class="ct-panel-swap"
              ?disabled=${this.language.from === 'auto'}
              title="Swap languages"
              @click=${this.swapLanguages}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 16l-4-4 4-4" />
                <path d="M17 8l4 4-4 4" />
                <line x1="3" y1="12" x2="21" y2="12" />
              </svg>
            </button>
            <div style="flex:1">
              <ct-select
                .value=${this.language.to}
                .options=${this.toOptions}
                @ct-change=${this.onLanguageToChange}
              ></ct-select>
            </div>
          </div>

          <!-- Input -->
          <ct-textarea
            placeholder="Enter text to translate..."
            .value=${this.inputText}
            rows="5"
            @ct-change=${this.onInputChange}
          ></ct-textarea>

          <!-- Action buttons -->
          <div class="ct-panel-actions">
            <button
              class="ct-panel-btn ct-panel-btn-primary"
              ?disabled=${!this.inputText.trim() || this.loading}
              @click=${this.onTranslate}
            >
              ${this.loading ? html`<span class="ct-panel-spinner"></span> Translating...` : 'Translate'}
            </button>
            <button class="ct-panel-btn ct-panel-btn-secondary" @click=${this.onClear}>Clear</button>
          </div>

          <!-- Error -->
          ${this.error ? html`<div class="ct-panel-error">${this.error}</div>` : nothing}

          <!-- Output -->
          ${this.outputText ? html`
            <div class="ct-panel-output-wrap">
              <div class="ct-panel-output-header">
                <span>Translation</span>
                <button class="ct-panel-copy" title="Copy" @click=${this.onCopy}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
              <div class="ct-panel-output">${this.outputText}</div>
            </div>
          ` : nothing}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chrome-translate-panel': ChromeTranslatePanel
  }
}
