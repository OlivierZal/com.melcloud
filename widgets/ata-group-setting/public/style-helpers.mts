const UINT32_RANGE = 4_294_967_296

// Uniform fraction in [0, 1) backed by the Web Crypto API — the jitter is
// purely cosmetic, but a CSPRNG costs nothing and satisfies security
// analyzers flagging Math.random
export const randomFraction = (): number => {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1))
  return value / UINT32_RANGE
}

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
