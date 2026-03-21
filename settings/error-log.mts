import type { ErrorDetails, ErrorLog, ErrorLogQuery } from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/HomeySettings'

import {
  getButtonElement,
  getDivElement,
  getInputElement,
  getLabelElement,
} from './dom.mts'

import { getErrorMessage, homeyApiGet } from './api.mts'
import { withDisablingButton } from './dom-helpers.mts'

const Modulo = {
  base10: 10,
  base100: 100,
} as const

const INITIAL_ERROR_COUNT = 0

/*
 * Slavic language pluralization rules: numbers ending in 2-4 use a special
 * form, except 12-14 which use the regular plural
 */
const NUMBER_ENDS_WITH_TWO = 2
const NUMBER_ENDS_WITH_THREE = 3
const NUMBER_ENDS_WITH_FOUR = 4
const numberEndsWithTwoThreeFour = new Set([
  NUMBER_ENDS_WITH_FOUR,
  NUMBER_ENDS_WITH_THREE,
  NUMBER_ENDS_WITH_TWO,
])

const PLURAL_THRESHOLD = 2
const PLURAL_EXCEPTION_TWELVE = 12
const PLURAL_EXCEPTION_THIRTEEN = 13
const PLURAL_EXCEPTION_FOURTEEN = 14
const pluralExceptions = new Set([
  PLURAL_EXCEPTION_FOURTEEN,
  PLURAL_EXCEPTION_THIRTEEN,
  PLURAL_EXCEPTION_TWELVE,
])

export class ErrorLogManager {
  readonly #errorCountLabelElement: HTMLLabelElement

  readonly #errorLogElement: HTMLDivElement

  readonly #homey: Homey

  readonly #periodLabelElement: HTMLLabelElement

  readonly #seeElement: HTMLButtonElement

  readonly #sinceElement: HTMLInputElement

  #errorCount = INITIAL_ERROR_COUNT

  #errorLogTBodyElement: HTMLTableSectionElement | null = null

  #from = ''

  #to = ''

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#errorLogElement = getDivElement('error_log')
    this.#errorCountLabelElement = getLabelElement('error_count')
    this.#periodLabelElement = getLabelElement('period')
    this.#sinceElement = getInputElement('since')
    this.#seeElement = getButtonElement('see')
  }

  public get from(): string {
    return this.#from
  }

  public get seeElementId(): string {
    return this.#seeElement.id
  }

  public get sinceElement(): HTMLInputElement {
    return this.#sinceElement
  }

  public get to(): string {
    return this.#to
  }

  public addEventListeners(): void {
    this.#sinceElement.addEventListener('change', () => {
      if (
        this.#to &&
        this.#sinceElement.value &&
        Date.parse(this.#sinceElement.value) > Date.parse(this.#to)
      ) {
        this.#sinceElement.value = this.#to
        this.#homey
          .alert(
            this.#homey.__('settings.errorLog.error', { from: this.#from }),
          )
          .catch(() => {
            //
          })
      }
    })
    this.#seeElement.addEventListener('click', () => {
      this.fetchErrorLog().catch(() => {
        //
      })
    })
  }

  public async fetchErrorLog(): Promise<void> {
    await withDisablingButton(this.#seeElement.id, async () => {
      try {
        const data = await homeyApiGet<ErrorLog>(
          this.#homey,
          `/logs/errors?${new URLSearchParams({
            from: this.#sinceElement.value,
            limit: '29',
            offset: '0',
            to: this.#to,
          } satisfies ErrorLogQuery)}`,
        )
        this.#updateErrorLogElements(data)
        this.#generateErrorLogTableData(data.errors)
      } catch (error) {
        await this.#homey.alert(getErrorMessage(error))
      }
    })
  }

  #generateErrorLogTable(keys: string[]): HTMLTableSectionElement {
    const tableElement = document.createElement('table')
    tableElement.classList.add('bordered')
    const theadElement = tableElement.createTHead()
    const rowElement = theadElement.insertRow()
    for (const key of keys) {
      const thElement = document.createElement('th')
      thElement.textContent = this.#homey.__(`settings.errorLog.columns.${key}`)
      rowElement.append(thElement)
    }
    this.#errorLogElement.append(tableElement)
    return tableElement.createTBody()
  }

  #generateErrorLogTableData(errors: readonly ErrorDetails[]): void {
    for (const error of errors) {
      this.#errorLogTBodyElement ??= this.#generateErrorLogTable(
        Object.keys(error),
      )
      const rowElement = this.#errorLogTBodyElement.insertRow()
      for (const value of Object.values(error)) {
        const cellElement = rowElement.insertCell()
        cellElement.textContent = String(value)
      }
    }
  }

  #getErrorCountText(count: number): string {
    if (count < PLURAL_THRESHOLD) {
      return this.#homey.__(`settings.errorLog.errorCount.${String(count)}`)
    }
    if (
      numberEndsWithTwoThreeFour.has(count % Modulo.base10) &&
      !pluralExceptions.has(count % Modulo.base100)
    ) {
      return this.#homey.__('settings.errorLog.errorCount.234')
    }
    return this.#homey.__('settings.errorLog.errorCount.plural')
  }

  #updateErrorLogElements({
    errors,
    fromDateHuman,
    nextFromDate,
    nextToDate,
  }: ErrorLog): void {
    this.#errorCount += errors.length
    this.#from = fromDateHuman
    this.#to = nextToDate
    this.#errorCountLabelElement.textContent = `${String(this.#errorCount)} ${this.#getErrorCountText(this.#errorCount)}`
    this.#periodLabelElement.textContent = this.#homey.__(
      'settings.errorLog.period',
      { from: this.#from },
    )
    this.#sinceElement.value = nextFromDate
  }
}
