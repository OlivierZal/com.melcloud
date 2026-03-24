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
  ((Math.random() * gap + min) * (multiplier ?? 1)) / ((divisor ?? 1) || 1)

export const generateStyleString = (
  params: { gap: number; min: number; divisor?: number; multiplier?: number },
  unit = '',
): string => `${String(generateStyleNumber(params))}${unit}`
