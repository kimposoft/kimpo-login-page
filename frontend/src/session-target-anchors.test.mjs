import { createApp, nextTick } from 'vue';
import { createSurface } from './index';

const anchors = Object.freeze([
  ['session-target-login-name', 'INPUT'],
  ['session-target-login-password', 'INPUT'],
  ['session-target-login-submit', 'BUTTON']
]);

function requireExactlyOneVisibleNative(root, testId, expectedTag) {
  const matches = root.querySelectorAll(`[data-testid="${testId}"]`);
  if (matches.length !== 1) {
    throw new Error(`${testId}: expected exactly one anchor, got ${matches.length}`);
  }
  const element = matches[0];
  if (element.tagName !== expectedTag) {
    throw new Error(`${testId}: expected native ${expectedTag}, got ${element.tagName}`);
  }
  const style = globalThis.getComputedStyle(element);
  if (
    !element.isConnected ||
    element.hidden ||
    element.getAttribute('aria-hidden') === 'true' ||
    style.display === 'none' ||
    style.visibility === 'hidden'
  ) {
    throw new Error(`${testId}: anchor is not visible`);
  }
  return element;
}

function createPasswordSurfaceInput() {
  const localeListeners = new Set();
  return {
    surfaceType: 'page-slot',
    slot: 'auth.login',
    hostCaps: [],
    hostContext: {},
    runtime: null,
    props: {
      methods: [{ id: 'local-password', kind: 'password', displayName: 'Password' }],
      captcha: { required: false }
    },
    hostBridge: {
      login: async () => ({ ok: false, errorCode: 'AUTH_INVALID_CREDENTIALS' }),
      startRedirect: async () => {},
      createQr: async () => ({ qrSessionId: 'unused', expiresIn: 60 }),
      pollQr: async () => ({ status: 'pending', loggedIn: false }),
      sendOtp: async () => ({ retryAfter: 60 }),
      verifyOtp: async () => ({ ok: false }),
      answerChallenge: async () => ({ ok: false }),
      refreshCaptcha: async () => ({ captchaId: 'unused', imageBase64: '' }),
      redirectFromLogin: () => {},
      message: { success: () => {}, error: () => {}, info: () => {} },
      i18n: {
        locale: { value: 'en-US' },
        t: () => '',
        resolve: value => (typeof value === 'string' ? value : ''),
        onLocaleChange: callback => {
          localeListeners.add(callback);
          return () => localeListeners.delete(callback);
        }
      },
      log: () => {}
    }
  };
}

describe('official login plugin session-target native anchors', () => {
  it('renders the PasswordForm native anchors through the normal createSurface/LoginPage path', async () => {
    const input = createPasswordSurfaceInput();
    const surface = createSurface(input);
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(surface.component, surface.props);

    try {
      app.mount(host);
      await nextTick();

      for (const [testId, tag] of anchors) {
        requireExactlyOneVisibleNative(host, testId, tag);
      }

      // NInput attrs normally land on its wrapper. The source-backed inputProps route must
      // put these anchors only on the native controls, never on a .n-input container.
      expect(host.querySelector('.n-input[data-testid="session-target-login-name"]')).toBeNull();
      expect(host.querySelector('.n-input[data-testid="session-target-login-password"]')).toBeNull();
      expect(host.querySelector('button.n-button[data-testid="session-target-login-submit"]')).not.toBeNull();
    } finally {
      app.unmount();
      host.remove();
    }
  });

  it('fails closed for missing, hidden, and duplicate native anchors', async () => {
    const input = createPasswordSurfaceInput();
    const surface = createSurface(input);
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(surface.component, surface.props);

    try {
      app.mount(host);
      await nextTick();

      expect(() => requireExactlyOneVisibleNative(host, 'missing-anchor', 'INPUT')).toThrow(
        'expected exactly one anchor, got 0'
      );

      const password = requireExactlyOneVisibleNative(host, 'session-target-login-password', 'INPUT');
      password.hidden = true;
      expect(() => requireExactlyOneVisibleNative(host, 'session-target-login-password', 'INPUT')).toThrow(
        'anchor is not visible'
      );
      password.hidden = false;

      const loginName = requireExactlyOneVisibleNative(host, 'session-target-login-name', 'INPUT');
      loginName.parentElement.append(loginName.cloneNode(true));
      expect(() => requireExactlyOneVisibleNative(host, 'session-target-login-name', 'INPUT')).toThrow(
        'expected exactly one anchor, got 2'
      );
    } finally {
      app.unmount();
      host.remove();
    }
  });
});
