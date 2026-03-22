const DEFAULT_DIVISOR_ONE = 1
const DEFAULT_MULTIPLIER_ONE = 1

export const generateStyleNumber = ({
  divisor,
  gap,
  min,
  multiplier,
}: {
  gap: number
  min: number
  divisor?: number
  multiplier?: number
}): number =>
  ((Math.random() * gap + min) * (multiplier ?? DEFAULT_MULTIPLIER_ONE)) /
  ((divisor ?? DEFAULT_DIVISOR_ONE) || DEFAULT_DIVISOR_ONE)

export const generateStyleString = (
  params: { gap: number; min: number; divisor?: number; multiplier?: number },
  unit = '',
): string => `${String(generateStyleNumber(params))}${unit}`
