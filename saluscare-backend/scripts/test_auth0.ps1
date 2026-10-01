# Smoke-test session-message with an Auth0 machine-to-machine token.
#
# The token is intentionally NOT stored in this file (JWTs in git are a leak
# waiting to happen, even when expired). Get one at runtime instead:
#
#   curl -s https://<AUTH0_DOMAIN>/oauth/token \
#     -d client_id=<M2M_CLIENT_ID> \
#     -d client_secret=<M2M_CLIENT_SECRET> \
#     -d audience=https://saluscare-api \
#     -d grant_type=client_credentials | jq -r .access_token
#
# Usage:
#   $env:SALUS_TEST_TOKEN = "<access_token>"; ./scripts/test_auth0.ps1

param()
$ErrorActionPreference = "Stop"

if (-not $env:SALUS_TEST_TOKEN) {
    Write-Error "Set SALUS_TEST_TOKEN first: `$env:SALUS_TEST_TOKEN = '<access_token>'"
    exit 1
}
$token = $env:SALUS_TEST_TOKEN

$body = @{
    text      = "I have a sore throat for the past day, no fever"
    sessionId = "88888888-8888-8888-8888-888888888888"
} | ConvertTo-Json

$body | Out-File -Encoding utf8 request5.json

curl.exe -X POST https://mracfdhnxewrigazlzbz.supabase.co/functions/v1/session-message `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer $token" `
    --data-binary "@request5.json"
