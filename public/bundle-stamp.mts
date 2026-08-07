// TEMPORARY (kit adoption test): shows the running bundle's `?v=`
// content stamp, so an on-device tester can prove the page is the
// branch's bundle and not a cached older one — and, once this commit is
// reverted, prove the refresh by watching the marker disappear. Each
// page carries its own bundle, so each shows its own stamp. Removed by
// the commit that follows the test.
const STAMP_LENGTH = 8

/**
 * Appends the bundle stamp to the page title, or shows it as a banner
 * where the page has no title (the widgets are title-less).
 */
export const showBundleStamp = (): void => {
  const stamp = [...document.querySelectorAll('script[src]')]
    .map(
      (element) =>
        /[?&]v=(?<hash>[^&"']+)/u.exec(element.getAttribute('src') ?? '')
          ?.groups?.hash,
    )
    .find((hash) => hash !== undefined)
  const label = `KIT-TEST ${stamp?.slice(0, STAMP_LENGTH) ?? 'unstamped'}`
  const titleElement = document.querySelector('.homey-title')
  if (titleElement === null) {
    const banner = document.createElement('p')
    banner.className = 'homey-text-small'
    banner.textContent = label
    document.body.prepend(banner)
    return
  }
  titleElement.textContent = `${titleElement.textContent} ${label}`
}
