// Test-only DOM helpers for component tests (jsdom lacks a few layout APIs).

/** Installs no-op versions of DOM APIs that jsdom does not implement. */
export function installDomStubs(): void {
  const proto = Element.prototype as Partial<Element> & Record<string, unknown>;
  proto.scrollIntoView ??= function scrollIntoView() {
    /* layout-free environment */
  };
  proto.setPointerCapture ??= function setPointerCapture() {
    /* layout-free environment */
  };
  proto.releasePointerCapture ??= function releasePointerCapture() {
    /* layout-free environment */
  };
  proto.hasPointerCapture ??= function hasPointerCapture() {
    return false;
  };
}
