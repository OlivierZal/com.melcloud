const cartesianProduct = ({ orderedModifiers }) =>
  orderedModifiers.reduce(
    (acc, array) =>
      acc.flatMap((accItem) =>
        array.map((item) => [
          ...(Array.isArray(accItem) ? accItem : [accItem]),
          item,
        ]),
      ),
    [[]],
  )

const allModifierCombos = ({ orderedModifiers }) =>
  cartesianProduct({ orderedModifiers }).map((combo) => combo.filter(Boolean))

const compatibleModifierCombos = ({
  modifierIncompatibilities,
  orderedModifiers,
}) =>
  allModifierCombos({ orderedModifiers }).filter((combo) =>
    combo.every((modifier) =>
      (modifierIncompatibilities[modifier] ?? []).every(
        (incompatibleModifier) => !combo.includes(incompatibleModifier),
      ),
    ),
  )

const buildGroupsForSelector = ({
  modifierIncompatibilities,
  orderedModifiers,
  selector,
  selectorIncompatibilities,
}) =>
  compatibleModifierCombos({ modifierIncompatibilities, orderedModifiers })
    .filter((combo) =>
      combo.every(
        (modifier) =>
          !(selectorIncompatibilities[selector] ?? []).includes(modifier),
      ),
    )
    .map((combo) => [...combo, selector].join('-'))

export const buildGroups = ({
  modifierIncompatibilities,
  orderedModifiers,
  selectorIncompatibilities,
  selectors,
}) =>
  selectors.flatMap((selector) => {
    if (Array.isArray(selector)) {
      const groupPairs = selector.map((pairedSelector) =>
        buildGroupsForSelector({
          modifierIncompatibilities,
          orderedModifiers,
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
      orderedModifiers,
      selector,
      selectorIncompatibilities,
    })
  })
