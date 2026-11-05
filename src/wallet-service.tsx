import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';

import type { AccountType, ICSPRClickSDK, SignResult } from '@make-software/csprclick-core-types';
import { loadClickSDK } from './csprclick';

export type SignTypedDataParams = {
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  };
  options?: {
    domainTypes?: Array<{ name: string; type: string }>;
    returnHashArtifacts?: boolean;
    rejectUnknownFields?: boolean;
  };
};

export type EIP712HashArtifacts = {
  domainTypeString?: string;
  domain?: Record<string, unknown>;
  domainSeparator?: string;
  canonicalTypeString?: string;
  typeHash?: string;
  structHash?: string;
};

export type SignTypedDataResult = {
  cancelled: boolean;
  signature: string | null;
  digest: string | null;
  publicKey: string | null;
  error: string | null;
  errorCode?: string;
  hashArtifacts?: EIP712HashArtifacts;
};

type WalletService = {
  logs: [string, object][];
  sdkReady: boolean;
  sdkError: string | null;
  activeProvider: string | null;
  signOut: () => Promise<void>;
  log: (msg: string, payload?: any) => void;
  activePublicKey: string | null;
  connect: () => Promise<boolean>;
  switchAccount: () => Promise<boolean>;
  sign: (
    deployJson: string,
    accountPublicKey: string
  ) => Promise<
    { cancelled: true; message?: string } | { cancelled: false; signature: Uint8Array }
  >;
  signMessage: (
    message: string,
    accountPublicKey: string
  ) => Promise<
    { cancelled: true } | { cancelled: false; signature: Uint8Array }
  >;
  signTypedData: (
    params: SignTypedDataParams,
    accountPublicKey: string
  ) => Promise<SignTypedDataResult | undefined>;
  decryptMessage: (
    message: string,
    signingPublicKeyHex: string
  ) => Promise<
    { cancelled: true } | { cancelled: false; decryptedMessage: string }
  >;
  encryptMessage: (
    message: string,
    signingPublicKeyHex: string
  ) => Promise<{ encryptedMessage: string }>;
  disconnect: () => Promise<boolean>;
  isSiteConnected: () => Promise<boolean>;
  getActivePublicKey: () => Promise<string | undefined>;
  getActiveKeySupports: () => Promise<string[] | undefined>;
  getVersion: () => Promise<string>;
};

export const walletServiceContext = createContext<WalletService>({} as any);

const { Provider: WalletServiceContextProvider } = walletServiceContext;

export const useWalletService = () => {
  return useContext(walletServiceContext);
};

// Adapt CSPR.click's nullable responses to the existing scenario handlers.
export function normalizeSignResult(result: SignResult | undefined):
  { cancelled: true; message?: string } | { cancelled: false; signature: Uint8Array } {
  if (result?.error) throw new Error(result.error);
  if (result?.cancelled) return { cancelled: true };
  if (!result?.signature) throw new Error('CSPR.click returned no signature.');
  return { cancelled: false, signature: result.signature };
}

export const WalletServiceProvider = ({ children }: React.PropsWithChildren<{}>) => {
  const [logs, setLogs] = useState<[string, object][]>([]);
  const log = useCallback((msg: string, payload?: any) =>
    setLogs(state => [[msg, payload], ...state]), []);
  const [sdk, setSDK] = useState<ICSPRClickSDK | null>(null);
  const [sdkError, setSDKError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountType | null>(null);

  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};
    loadClickSDK().then(click => {
      if (disposed) return;
      const syncAccount = () => setAccount(click.getActiveAccount() || null);
      const onAccount = (event: { account: AccountType }) => {
        log('event:account', event.account);
        setAccount(event.account);
      };
      const onSignedOut = () => {
        log('event:signed_out');
        setAccount(null);
      };
      const onDisconnected = (event: { provider: string }) => {
        log('event:disconnected', event);
        // A background provider disconnection must not clear another session.
        setAccount(current => current?.provider === event.provider ? null : current);
      };
      const onUnsolicitedChange = (event: { account: AccountType }) => {
        // Follow external changes only for the provider of the active session.
        if (click.getActiveAccount()?.provider !== event.account.provider) return;
        click.signInWithAccount(event.account).catch(error => {
          log('Account change failed', { error: String(error) });
          syncAccount();
        });
      };
      const listeners: [string, (...args: any[]) => void][] = [
        ['csprclick:signed_in', onAccount],
        ['csprclick:switched_account', onAccount],
        ['csprclick:signed_out', onSignedOut],
        ['csprclick:disconnected', onDisconnected],
        ['csprclick:unsolicited_account_change', onUnsolicitedChange],
        ['csprclick:provider-status-update', syncAccount]
      ];
      listeners.forEach(([name, listener]) => click.on(name, listener));
      unsubscribe = () => listeners.forEach(([name, listener]) => click.off(name, listener));
      syncAccount();
      setSDK(click);
    }).catch(error => {
      if (!disposed) setSDKError(String(error.message || error));
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [log]);

  const getSDK = () => {
    if (!sdk) throw new Error(sdkError || 'CSPR.click is still loading.');
    return sdk;
  };
  const getSigningKey = (key: string) => {
    const active = getSDK().getActiveAccount();
    if (!active) throw new Error('Connect a wallet through CSPR.click first.');
    if (active.public_key.toLowerCase() !== key.toLowerCase()) {
      throw new Error('The signing key must match the active CSPR.click account. Switch accounts first.');
    }
    return active.public_key.toLowerCase();
  };

  const contextProps: WalletService = {
    logs,
    log,
    sdkReady: Boolean(sdk),
    sdkError,
    activePublicKey: account?.public_key.toLowerCase() || null,
    activeProvider: account?.provider || null,
    connect: async () => {
      getSDK().signIn();
      return true; // Opening the chooser; the signed_in event confirms connection.
    },
    switchAccount: async () => {
      // Empty provider opens CSPR.click's chooser, including other providers.
      await getSDK().switchAccount('');
      return true;
    },
    disconnect: async () => {
      const click = getSDK();
      const active = click.getActiveAccount();
      if (!active) return false;
      await click.disconnect(active.provider);
      setAccount(click.getActiveAccount() || null);
      return true;
    },
    signOut: async () => {
      getSDK().signOut();
      setAccount(null);
    },
    sign: async (json, key) => normalizeSignResult(await getSDK().sign(json, getSigningKey(key))),
    signMessage: async (message, key) => normalizeSignResult(await getSDK().signMessage(message, getSigningKey(key))),
    signTypedData: async (params, key) => {
      const result = await getSDK().signTypedData(params, getSigningKey(key));
      return result ? { ...result, signature: result.signatureHex } : undefined;
    },
    encryptMessage: async (message, key) => {
      const result = await getSDK().encryptMessage(message, getSigningKey(key));
      if (result?.error) throw new Error(result.error);
      if (result?.cancelled) throw new Error('Encryption cancelled.');
      if (result?.encryptedMessage == null) throw new Error('CSPR.click returned no encrypted message.');
      return { encryptedMessage: result.encryptedMessage };
    },
    decryptMessage: async (message, key) => {
      const result = await getSDK().decryptMessage(message, getSigningKey(key));
      if (result?.error) throw new Error(result.error);
      if (result?.cancelled) return { cancelled: true };
      if (result?.decryptedMessage == null) throw new Error('CSPR.click returned no decrypted message.');
      return { cancelled: false, decryptedMessage: result.decryptedMessage };
    },
    isSiteConnected: async () => {
      const click = getSDK();
      const active = click.getActiveAccount();
      return active ? Boolean(await click.isConnected(active.provider)) : false;
    },
    getActivePublicKey: async () => getSDK().getActiveAccount()?.public_key.toLowerCase(),
    getActiveKeySupports: async () => (await getSDK().getProviderInfo())?.supports,
    getVersion: async () => (await getSDK().getProviderVersion()) || 'Provider version unavailable'
  };

  return <WalletServiceContextProvider value={contextProps}>{children}</WalletServiceContextProvider>;
};
