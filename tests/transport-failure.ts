// A transport failure as Node's fetch reports one: `TypeError: fetch
// failed` with undici's coded error on `cause`. It is the failure the
// SDK's `logFailure` folds onto ONE line, which the clauses pin verbatim:
// each link as `name: message`, the code appended, ` — caused by ` between.
export const TRANSPORT_FAILURE_CHAIN =
  'TypeError: fetch failed — caused by Error: Connect Timeout Error (UND_ERR_CONNECT_TIMEOUT)'

export const createTransportFailure = (): TypeError =>
  new TypeError('fetch failed', {
    cause: Object.assign(new Error('Connect Timeout Error'), {
      code: 'UND_ERR_CONNECT_TIMEOUT',
    }),
  })
