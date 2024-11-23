const cartesianProduct = (arrays) =>
  arrays.reduce(
    (acc, array) =>
      acc.flatMap((accItem) =>
        array.map((item) => [
          ...(Array.isArray(accItem) ? accItem : [accItem]),
          item,
        ]),
      ),
    [[]],
  )

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
}) =>
  compatibleModifierCombos({ modifierIncompatibilities, modifiers })
    .filter((combo) =>
      combo.every(
        (modifier) =>
          !(selectorIncompatibilities[selector] ?? []).includes(modifier),
      ),
    )
    .map((combo) => [...combo, selector].join('-'))

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
      return [...Array(groupPair.length).keys()].map((index) =>
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
