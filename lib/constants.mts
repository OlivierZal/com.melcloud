// SI kilo prefix ratio, shared by the W <-> kW and Wh <-> kWh
// conversions alike.
export const KILO = 1000

// Tabular missing-value marker (language-neutral, unlike an N/A) for a
// wire stamp that carries no instant (`null` epoch reads from the
// library); the row or capability itself is kept — the fact is real
// even without its moment.
export const UNKNOWN_DATE_PLACEHOLDER = '—'
