import * as ExpoCrypto from 'expo-crypto';

type MutableCrypto = Crypto & {
  randomUUID?: () => string;
};

let installed = false;

export function ensureReportCrypto(): void {
  if (installed) return;
  installed = true;

  try {
    const scope = globalThis as typeof globalThis & { crypto?: MutableCrypto };
    const polyfill = {
      getRandomValues: <T extends ArrayBufferView>(array: T): T =>
        ExpoCrypto.getRandomValues(array as never) as T,
      randomUUID: () => ExpoCrypto.randomUUID(),
    } as unknown as MutableCrypto;

    if (!scope.crypto) {
      scope.crypto = polyfill;
    } else {
      if (typeof scope.crypto.randomUUID !== 'function') {
        Object.defineProperty(scope.crypto, 'randomUUID', {
          configurable: true,
          value: polyfill.randomUUID,
        });
      }
      if (typeof scope.crypto.getRandomValues !== 'function') {
        Object.defineProperty(scope.crypto, 'getRandomValues', {
          configurable: true,
          value: polyfill.getRandomValues,
        });
      }
    }
  } catch {
    return;
  }
}
