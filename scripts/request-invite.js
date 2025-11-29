#!/usr/bin/env node
'use strict';

const args = process.argv.slice(2);

const getFlagValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
};

const baseUrl = getFlagValue('--url') || process.env.INVITE_BASE_URL;
if (!baseUrl) {
  console.error('Missing base URL. Pass --url https://<deployment> or set INVITE_BASE_URL.');
  process.exit(1);
}

const adminToken = getFlagValue('--token') || process.env.ADMIN_TOKEN;
if (!adminToken) {
  console.error('Missing admin token. Pass --token <value> or set ADMIN_TOKEN.');
  process.exit(1);
}

const expiresAtFlag = getFlagValue('--expires-at');
let expiresAt = null;
if (expiresAtFlag) {
  const parsedDate = new Date(expiresAtFlag);
  if (Number.isNaN(parsedDate.getTime())) {
    console.error(`Invalid --expires-at value: ${expiresAtFlag}`);
    process.exit(1);
  }
  expiresAt = parsedDate.toISOString();
}

const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

async function main() {
  let response;
  try {
    response = await fetch(`${normalizedBaseUrl}/api/invites`, {
      method: 'POST',
      headers: {
        'x-admin-token': adminToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ expiresAt }),
    });
  } catch (error) {
    const networkHint =
      error?.code === 'ENETUNREACH'
        ? 'Network unreachable: ensure this environment can reach your deployment.'
        : error?.code === 'ENOTFOUND'
          ? 'Host could not be resolved: double-check the --url and DNS access.'
          : error?.code === 'ECONNREFUSED'
            ? 'Connection refused: verify the deployment is running and not blocking requests.'
            : 'Unexpected network error occurred while contacting /api/invites.';

    console.error(networkHint, '\nRaw error:', error);
    process.exit(1);
  }

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    console.error('Request failed', { status: response.status, body: parsed });
    process.exit(1);
  }

  console.log('Invite issued successfully:', parsed);
}

main().catch((error) => {
  console.error('Unexpected error while calling /api/invites:', error);
  process.exit(1);
});
