const cartesianProduct = (arrays: string[][]): string[][] => {
  let result: string[][] = [[]]
  for (const array of arrays) {
    result = result.flatMap((partial) =>
      array.map((item) => [...partial, item]),
    )
  }
  return result
}

const modifierCombos = ({ modifiers }: { modifiers: string[][] }): string[][] =>
  cartesianProduct(modifiers).map((combo) => combo.filter(Boolean))

const compatibleModifierCombos = ({
  modifierIncompatibilities,
  modifiers,
}: {
  modifierIncompatibilities: Record<string, Set<string>>
  modifiers: string[][]
}): string[][] =>
  modifierCombos({ modifiers }).filter((combo) => {
    const comboSet = new Set(combo)
    return combo.every((modifier) => {
      const { [modifier]: incompatibles } = modifierIncompatibilities
      return !incompatibles || incompatibles.isDisjointFrom(comboSet)
    })
  })

const buildGroupsForSelector = ({
  modifierIncompatibilities,
  modifiers,
  selector,
  selectorIncompatibilities,
}: {
  modifierIncompatibilities: Record<string, Set<string>>
  modifiers: string[][]
  selector: string
  selectorIncompatibilities: Record<string, Set<string>>
}): string[] =>
  compatibleModifierCombos({ modifierIncompatibilities, modifiers })
    .filter((combo) => {
      const { [selector]: incompatibilities } = selectorIncompatibilities
      return incompatibilities ?
          incompatibilities.isDisjointFrom(new Set(combo))
        : true
    })
    .map((combo) => [...combo, selector].join('-'))

export const buildGroups = ({
  modifierIncompatibilities,
  modifiers,
  selectorIncompatibilities,
  selectors,
}: {
  modifierIncompatibilities: Record<string, Set<string>>
  modifiers: string[][]
  selectorIncompatibilities: Record<string, Set<string>>
  selectors: (string | string[])[]
}): (string | string[])[] => {
  const result: (string | string[])[] = []
  for (const selector of selectors) {
    if (Array.isArray(selector)) {
      const groupPairs = selector.map((pairedSelector) =>
        buildGroupsForSelector({
          modifierIncompatibilities,
          modifiers,
          selector: pairedSelector,
          selectorIncompatibilities,
        }),
      )
      const [firstGroup = []] = groupPairs
      for (const [index] of firstGroup.entries()) {
        result.push(
          groupPairs.flatMap((groupPair) => {
            const { [index]: value } = groupPair
            return value !== undefined && value !== '' ? [value] : []
          }),
        )
      }
    } else {
      result.push(
        ...buildGroupsForSelector({
          modifierIncompatibilities,
          modifiers,
          selector,
          selectorIncompatibilities,
        }),
      )
    }
  }
  return result
}
