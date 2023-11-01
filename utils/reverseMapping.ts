export default function reverseMapping(
  mapping: Record<number, string>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(mapping).map(
      ([deviceValue, capabilityValue]: [string, string]): [string, number] => [
        capabilityValue,
        Number(deviceValue),
      ],
    ),
  )
}
