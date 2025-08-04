const cartesianProduct = (arrays) => {
  let result = [[]]
  for (const array of arrays) {
    const temporary = []
    for (const partial of result) {
      for (const item of array) {
        temporary.push([...partial, item])
      }
    }
    result = temporary
  }
  return result
}

const modifierCombos = ({ modifiers }) =>
  cartesianProduct(modifiers).map((combo) => combo.filter(Boolean))

const compatibleModifierCombos = ({ modifierIncompatibilities, modifiers }) =>
  modifierCombos({ modifiers }).filter((combo) =>
    combo.every((modifier) =>
      (modifierIncompatibilities[modifier] ?? []).every(
        (incompatibleModifier) => !combo.includes(incompatibleModifier),
      ),
    ),
  )

const buildGroupsForSelector = ({
  modifierIncompatibilities,
  modifiers,
  selector,
  selectorIncompatibilities,
}) => {
  const incompatibilities = new Set(selectorIncompatibilities[selector] ?? [])
  return compatibleModifierCombos({ modifierIncompatibilities, modifiers })
    .filter((combo) =>
      combo.every((modifier) => !incompatibilities.has(modifier)),
    )
    .map((combo) => [...combo, selector].join('-'))
}

export const buildGroups = ({
  modifierIncompatibilities,
  modifiers,
  selectorIncompatibilities,
  selectors,
}) =>
  selectors.flatMap((selector) => {
    if (Array.isArray(selector)) {
      const groupPairs = selector.map((pairedSelector) =>
        buildGroupsForSelector({
          modifierIncompatibilities,
          modifiers,
          selector: pairedSelector,
          selectorIncompatibilities,
        }),
      )
      const [groupPair] = groupPairs
      return [...Array.from({ length: groupPair.length }).keys()].map((index) =>
        groupPairs.map((group) => group[index]),
      )
    }
    return buildGroupsForSelector({
      modifierIncompatibilities,
      modifiers,
      selector,
      selectorIncompatibilities,
    })
  })
