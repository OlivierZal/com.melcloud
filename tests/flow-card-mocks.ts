import { vi } from 'vitest'

interface FlowCardsStub {
  readonly getActionCard: ReturnType<typeof vi.fn>
  readonly getConditionCard: ReturnType<typeof vi.fn>
}

interface RunListenerCard {
  readonly registerRunListener: (
    listener: (args: Record<string, unknown>) => unknown,
  ) => void
}

const createCard = (): RunListenerCard => ({
  registerRunListener:
    vi.fn<(listener: (args: Record<string, unknown>) => unknown) => void>(),
})

// Every driver mock stubs the same two flow-card getters, each answering
// one card whose only member is its run-listener registrar. The card is
// created once per getter, so a suite can assert on the registration.
export const createFlowCardsStub = (): FlowCardsStub => ({
  getActionCard: vi
    .fn<(id: string) => RunListenerCard>()
    .mockReturnValue(createCard()),
  getConditionCard: vi
    .fn<(id: string) => RunListenerCard>()
    .mockReturnValue(createCard()),
})
