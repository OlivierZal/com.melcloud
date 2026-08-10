/**
 * Chart.js's arc element, reduced to what the pie plugins read.
 *
 * Mirrors the renderer's own API — `getProps(names)` answers the names the
 * caller asks for — so the element's short vocabulary (`x`, `y`) stays wire
 * data instead of leaking into our identifiers. The widget narrows slices
 * with `instanceof ArcElement`, so this has to be a real constructor; it
 * lives in its own module because the charts double already owns a class.
 */
export class ChartArcElement {
  readonly #props: ReadonlyMap<string, number | null>

  public constructor(props: ReadonlyMap<string, number | null>) {
    this.#props = props
  }

  public getProps(names: readonly string[]): Record<string, number | null> {
    return Object.fromEntries(
      names.map((name) => [name, this.#props.get(name) ?? null]),
    )
  }
}
