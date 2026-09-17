$imageBytes = [System.IO.File]::ReadAllBytes("$PWD\test-image.webp")
$base64 = [System.Convert]::ToBase64String($imageBytes)

$body = @{
    imageBase64 = $base64
    imageMimeType = "image/webp"
    sessionId = "55555555-5555-5555-5555-555555555555"
} | ConvertTo-Json

$body | Out-File -Encoding utf8 request2.json

curl.exe -X POST https://mracfdhnxewrigazlzbz.supabase.co/functions/v1/session-image `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer sb_publishable_8vwZmWgm4eWmvhRu_Anrmg_oLNds4_q" `
  --data-binary "@request2.json"