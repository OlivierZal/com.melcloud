import { generateStyleNumber } from './style-helpers.mts'

const BLUR_DIVISOR = 10
const FULL_CIRCLE = 2 * Math.PI

export const SmokeThreshold = {
  iterations: 10,
  opacityMin: 0,
  positionYMin: -50,
  sizeMin: 0.1,
} as const

export class SmokeParticle {
  public opacity: number = generateStyleNumber({ gap: 0.05, min: 0.05 })

  public positionY: number

  public size: number = generateStyleNumber({ gap: 2, min: 2 })

  readonly #context: CanvasRenderingContext2D

  #positionX: number

  readonly #speedX: number

  readonly #speedY: number

  public constructor(
    context: CanvasRenderingContext2D,
    positionX: number,
    positionY: number,
  ) {
    this.#context = context
    this.#positionX = positionX
    this.#speedX = generateStyleNumber({ gap: 0.2, min: -0.1 })
    this.#speedY = generateStyleNumber({ gap: 0.6, min: 0.2 })
    this.positionY = positionY
  }

  public draw(): void {
    this.#context.beginPath()
    this.#context.arc(
      this.#positionX,
      this.positionY,
      this.size,
      0,
      FULL_CIRCLE,
    )
    this.#context.filter = `blur(${String(this.size / BLUR_DIVISOR)}px)`
    this.#context.fillStyle = `rgba(200, 200, 200, ${String(this.opacity)})`
    this.#context.fill()
    this.#context.filter = 'none'
  }

  public update(speed: number): void {
    this.opacity -= 0.001
    this.#positionX += this.#speedX * speed
    this.positionY -= this.#speedY * speed
    this.size *= 1.002
  }
}
