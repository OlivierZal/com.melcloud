// Thrown when a device or zone lookup fails. Lets `ensureDevice` distinguish
// expected lookup failures (user-visible warning) from programming errors
// (logged only), while Homey's API layer still serializes the localized
// message for settings/widget clients.
export class NotFoundError extends Error {
  public override name = 'NotFoundError'
}
