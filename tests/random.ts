import { vi } from 'vitest'

// One past the largest uint32: half of it draws a fraction of one half.
export const UINT32_RANGE = 4_294_967_296

// Pins the CSPRNG behind the widgets' `randomFraction`, so every value
// drawn from it is exact: the uint32 it scales onto [0, 1). Zero
// collapses the animation's spawn delays, letting a scene tick per
// macrotask, and puts a chart refresh on five past the hour.
export const stubRandomUint32 = (value: number): void => {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
    if (array instanceof Uint32Array) {
      array.fill(value)
    }
    return array
  })
}
