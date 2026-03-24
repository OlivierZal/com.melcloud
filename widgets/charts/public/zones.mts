export const getZoneId = (id: number, model: string): string =>
  `${model}_${String(id)}`

export const getZonePath = (value: string): string => value.replace('_', '/')

export const getZoneName = (name: string, level: number): string =>
  `${'···'.repeat(level)} ${name}`
