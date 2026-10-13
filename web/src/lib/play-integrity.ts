import {createSign} from 'node:crypto';

type ServiceAccount = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

type DecodedIntegrityPayload = {
  requestDetails?: {
    requestPackageName?: string;
    requestHash?: string;
    timestampMillis?: string | number;
  };
  appIntegrity?: {
    appRecognitionVerdict?: string;
    packageName?: string;
    certificateSha256Digest?: string[];
  };
  deviceIntegrity?: {
    deviceRecognitionVerdict?: string[];
  };
};

export class PlayIntegrityVerificationError extends Error {
  constructor(
    readonly code: 'not_configured' | 'invalid_token' | 'untrusted_app' | 'untrusted_device' | 'request_mismatch' | 'stale_token',
    message: string
  ) {
    super(message);
    this.name = 'PlayIntegrityVerificationError';
  }
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function serviceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON;
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  const certDigest = process.env.GOOGLE_PLAY_APP_CERT_SHA256;
  if (!raw || !packageName || !certDigest) {
    throw new PlayIntegrityVerificationError(
      'not_configured',
      'Play Integrity server credentials are not configured.'
    );
  }
  let account: ServiceAccount;
  try {
    account = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new PlayIntegrityVerificationError('not_configured', 'Invalid service account configuration.');
  }
  if (!account.client_email || !account.private_key) {
    throw new PlayIntegrityVerificationError('not_configured', 'Incomplete service account configuration.');
  }
  return account;
}

async function googleAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
  const payload = base64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/playintegrity',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + '.' + payload;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = unsigned + '.' + signer.sign((account.private_key || '').replace(/\\n/g, '\n')).toString('base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  if (!response.ok) throw new PlayIntegrityVerificationError('not_configured', 'Google OAuth token exchange failed.');
  const body = await response.json() as {access_token?: string};
  if (!body.access_token) throw new PlayIntegrityVerificationError('not_configured', 'Google OAuth returned no access token.');
  return body.access_token;
}

/**
 * Decodes the opaque Play Integrity token on the server and validates package,
 * signer, device integrity, request hash and freshness. Never call this from
 * client code and never accept the client's claimed decoded payload.
 */
export async function verifyPlayIntegrityToken(
  integrityToken: string,
  expectedRequestHash: string
): Promise<{timestampMillis: number; packageName: string}> {
  if (!integrityToken || integrityToken.length > 20000 ||
      !/^[0-9a-f]{64}$/.test(expectedRequestHash)) {
    throw new PlayIntegrityVerificationError('invalid_token', 'Invalid Play Integrity request.');
  }

  const account = serviceAccount();
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME!;
  const expectedCertDigest = process.env.GOOGLE_PLAY_APP_CERT_SHA256!;
  const accessToken = await googleAccessToken(account);
  const response = await fetch(
    'https://playintegrity.googleapis.com/v1/' + encodeURIComponent(packageName) + ':decodeIntegrityToken',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({integrityToken})
    }
  );
  if (!response.ok) {
    throw new PlayIntegrityVerificationError('invalid_token', 'Google could not decode the integrity token.');
  }

  const body = await response.json() as {tokenPayloadExternal?: DecodedIntegrityPayload};
  const payload = body.tokenPayloadExternal;
  if (!payload) throw new PlayIntegrityVerificationError('invalid_token', 'Missing decoded integrity payload.');

  const details = payload.requestDetails;
  const timestampMillis = Number(details?.timestampMillis);
  if (details?.requestPackageName !== packageName ||
      details?.requestHash !== expectedRequestHash) {
    throw new PlayIntegrityVerificationError('request_mismatch', 'Integrity token does not match the requested data.');
  }
  if (!Number.isFinite(timestampMillis) ||
      timestampMillis < Date.now() - 2 * 60 * 1000 ||
      timestampMillis > Date.now() + 30_000) {
    throw new PlayIntegrityVerificationError('stale_token', 'Integrity token is outside the accepted time window.');
  }

  const app = payload.appIntegrity;
  const deviceVerdicts = payload.deviceIntegrity?.deviceRecognitionVerdict || [];
  if (app?.appRecognitionVerdict !== 'PLAY_RECOGNIZED' ||
      app.packageName !== packageName ||
      !(app.certificateSha256Digest || []).includes(expectedCertDigest)) {
    throw new PlayIntegrityVerificationError('untrusted_app', 'App identity or signing certificate was not recognized.');
  }
  if (!deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')) {
    throw new PlayIntegrityVerificationError('untrusted_device', 'Device integrity requirements were not met.');
  }

  return {timestampMillis, packageName};
}
