import { randomFraction } from '../../../public/random.mts'

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
}): number =>
  ((randomFraction() * gap + min) * multiplier) / (divisor === 0 ? 1 : divisor)

export const generateStyleString = (
  params: { gap: number; min: number; divisor?: number; multiplier?: number },
  unit = '',
): string => `${String(generateStyleNumber(params))}${unit}`
