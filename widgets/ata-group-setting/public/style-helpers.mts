export const generateStyleNumber = ({
  divisor = 1,
  gap,
  min,
  multiplier = 1,
}: {
  gap: number
  min: number
  divisor?: number
  multiplier?: number
}): number => ((Math.random() * gap + min) * multiplier) / (divisor || 1)

export const generateStyleString = (
  params: { gap: number; min: number; divisor?: number; multiplier?: number },
  unit = '',
): string => `${String(generateStyleNumber(params))}${unit}`
