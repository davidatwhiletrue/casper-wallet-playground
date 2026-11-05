import type {
  CsprClickInitOptions,
  ICSPRClickSDK
} from '@make-software/csprclick-core-types';
import type { ClickUIOptions } from '@make-software/csprclick-core-types/clickui';

declare global {
  interface Window {
    csprclick?: ICSPRClickSDK;
    clickSDKOptions?: CsprClickInitOptions;
    clickUIOptions?: ClickUIOptions;
  }
}

let sdkPromise: Promise<ICSPRClickSDK> | undefined;

// Share one initialization across React StrictMode mounts. The loaded event, not
// the presence of window.csprclick, determines when SDK methods are safe to call.
export function loadClickSDK(): Promise<ICSPRClickSDK> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'csprclick-script';
    script.src = process.env.REACT_APP_CSPRCLICK_SCRIPT_URL ||
      'https://cdn.cspr.click/rc-ui/v2.2.0/csprclick-client-2.2.0.js';
    script.async = true;

    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener('csprclick:loaded', onLoaded);
      script.onerror = null;
    };
    const fail = () => {
      cleanup();
      script.remove();
      reject(new Error('Unable to load CSPR.click. Check your connection and reload the page.'));
    };
    const onLoaded = () => {
      if (!window.csprclick) return fail();
      cleanup();
      resolve(window.csprclick);
    };
    const timeout = setTimeout(fail, 30000);
    window.addEventListener('csprclick:loaded', onLoaded);
    script.onerror = fail;

    window.clickSDKOptions = {
      appName: 'Casper Wallet Playground',
      appId: process.env.REACT_APP_CSPRCLICK_APP_ID || 'csprclick-template',
      contentMode: 'popup',
      providers: ['casper-wallet', 'ledger', 'metamask-snap', 'csprclick-w3a-google'],
      ...(process.env.REACT_APP_CSPRCLICK_HOST
        ? { csprclickHost: process.env.REACT_APP_CSPRCLICK_HOST }
        : {})
    };
    window.clickUIOptions = {
      uiContainer: 'csprclick-ui',
      rootAppElement: '#root',
      defaultTheme: 'light',
      accountMenuItems: ['AccountCardMenuItem', 'CopyHashMenuItem']
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}
