import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import type { AccountType, SignResult } from '@make-software/csprclick-core-types';
import { loadClickSDK } from './csprclick';
import { normalizeSignResult, useWalletService, WalletServiceProvider } from './wallet-service';

jest.mock('./csprclick', () => ({ loadClickSDK: jest.fn() }));

const account = { public_key: '01AB', provider: 'casper-wallet' } as AccountType;

function setup() {
  let active: AccountType | null = account;
  const listeners = new Map<string, (...args: any[]) => void>();
  const click = {
    getActiveAccount: jest.fn(() => active),
    on: jest.fn((name, listener) => listeners.set(name, listener)),
    off: jest.fn((name, listener) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    }),
    sign: jest.fn().mockResolvedValue({ signature: new Uint8Array([1]), cancelled: false }),
    signMessage: jest.fn().mockResolvedValue({ cancelled: true }),
    signTypedData: jest.fn().mockResolvedValue({ signatureHex: '01abc', cancelled: false }),
    encryptMessage: jest.fn().mockResolvedValue({ error: 'Provider cannot encrypt', cancelled: false }),
    decryptMessage: jest.fn().mockResolvedValue({ decryptedMessage: '', cancelled: false }),
    signIn: jest.fn(),
    switchAccount: jest.fn(),
    signOut: jest.fn(() => { active = null; }),
    disconnect: jest.fn(() => { active = null; })
  };
  (loadClickSDK as jest.Mock).mockResolvedValue(click);
  let wallet: ReturnType<typeof useWalletService>;
  function Consumer() {
    wallet = useWalletService();
    return null;
  }
  const view = render(<React.StrictMode><WalletServiceProvider><Consumer /></WalletServiceProvider></React.StrictMode>);
  return { click, listeners, view, getWallet: () => wallet! };
}

it('restores the SDK session and cleans up listeners across StrictMode mounts', async () => {
  const { getWallet, listeners, view } = setup();
  await waitFor(() => expect(getWallet().sdkReady).toBe(true));
  expect(getWallet().activePublicKey).toBe('01ab');
  act(() => listeners.get('csprclick:switched_account')?.({ account: { ...account, provider: 'ledger', public_key: '02CD' } }));
  expect(getWallet().activeProvider).toBe('ledger');
  act(() => listeners.get('csprclick:disconnected')?.({ provider: 'casper-wallet' }));
  expect(getWallet().activePublicKey).toBe('02cd');
  act(() => listeners.get('csprclick:signed_out')?.());
  expect(getWallet().activePublicKey).toBeNull();
  view.unmount();
  expect(listeners.size).toBe(0);
});

it('routes signatures through CSPR.click with the active lowercased key', async () => {
  const { getWallet, click } = setup();
  await waitFor(() => expect(getWallet().sdkReady).toBe(true));
  await expect(getWallet().sign('{}', '01AB')).resolves.toEqual({ cancelled: false, signature: new Uint8Array([1]) });
  expect(click.sign).toHaveBeenCalledWith('{}', '01ab');
  await expect(getWallet().sign('{}', '02cd')).rejects.toThrow('must match');
  expect(click.sign).toHaveBeenCalledTimes(1);
  await expect(getWallet().signMessage('hello', '01AB')).resolves.toEqual({ cancelled: true });
  await expect(getWallet().encryptMessage('hello', '01AB')).rejects.toThrow('Provider cannot encrypt');
  await expect(getWallet().decryptMessage('ciphertext', '01AB')).resolves.toEqual({ cancelled: false, decryptedMessage: '' });
  const params = { typedData: { domain: {}, types: {}, primaryType: 'Test', message: {} } };
  await expect(getWallet().signTypedData(params, '01AB')).resolves.toMatchObject({ signature: '01abc' });
});

it('opens the provider chooser and keeps sign-out distinct from disconnection', async () => {
  const { getWallet, click } = setup();
  await waitFor(() => expect(getWallet().sdkReady).toBe(true));
  await getWallet().connect();
  await getWallet().switchAccount();
  expect(click.signIn).toHaveBeenCalled();
  expect(click.switchAccount).toHaveBeenCalledWith('');
  await act(async () => { await getWallet().disconnect(); });
  expect(click.disconnect).toHaveBeenCalledWith('casper-wallet');
  expect(click.signOut).not.toHaveBeenCalled();
  await act(async () => { await getWallet().signOut(); });
  expect(click.signOut).toHaveBeenCalled();
});

it('reports SDK initialization failures', async () => {
  (loadClickSDK as jest.Mock).mockRejectedValue(new Error('Network failure'));
  let error: string | null = null;
  function Consumer() { error = useWalletService().sdkError; return null; }
  render(<WalletServiceProvider><Consumer /></WalletServiceProvider>);
  await waitFor(() => expect(error).toBe('Network failure'));
});

it('does not treat empty or failed SDK responses as successful signatures', () => {
  expect(() => normalizeSignResult(undefined)).toThrow('no signature');
  expect(() => normalizeSignResult({ error: 'Unsupported by provider' } as SignResult)).toThrow('Unsupported by provider');
});
