import { loadClickSDK } from './csprclick';
import type { ICSPRClickSDK } from '@make-software/csprclick-core-types';

it('configures the SDK before injection and waits for loaded, sharing initialization', async () => {
  const sdk = {} as ICSPRClickSDK;
  window.csprclick = sdk;
  let completed = false;
  const append = jest.spyOn(document.head, 'appendChild');
  append.mockImplementation(node => {
    expect(window.clickSDKOptions?.providers).toContain('ledger');
    expect(window.clickUIOptions?.uiContainer).toBe('csprclick-ui');
    return node;
  });
  const promise = loadClickSDK();
  promise.then(() => { completed = true; });
  expect(loadClickSDK()).toBe(promise);
  await Promise.resolve();
  expect(completed).toBe(false);
  window.dispatchEvent(new Event('csprclick:loaded'));
  await expect(promise).resolves.toBe(sdk);
  expect(append).toHaveBeenCalledTimes(1);
  append.mockRestore();
  delete window.csprclick;
});
