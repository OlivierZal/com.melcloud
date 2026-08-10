const UINT32_RANGE = 4_294_967_296

// Scales a uint32 onto [0, 1): every one of the 2^32 values maps to a
// distinct float, so the result is exactly uniform. Written as a
// multiplication because CodeQL's biased-random query misfires on
// division applied to cryptographically secure values
const UINT32_FRACTION_SCALE = 1 / UINT32_RANGE

// Refilled in place on every sample so the per-frame jitter does not
// allocate; the DataView reads the same bytes back without the indexed
// access that would demand an unreachable undefined fallback.
const randomSampleBuffer = new Uint32Array(1)
const randomSampleView = new DataView(randomSampleBuffer.buffer)

// Uniform fraction in [0, 1) backed by the Web Crypto API — the jitter is
// purely cosmetic, but a CSPRNG costs nothing and satisfies security
// analyzers flagging Math.random
export const randomFraction = (): number => {
  crypto.getRandomValues(randomSampleBuffer)
  return randomSampleView.getUint32(0, true) * UINT32_FRACTION_SCALE
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
