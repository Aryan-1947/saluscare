$imageBytes = [System.IO.File]::ReadAllBytes("$PWD\test-image.webp")
$base64 = [System.Convert]::ToBase64String($imageBytes)

$body = @{
    imageBase64 = $base64
    imageMimeType = "image/webp"
    text = "This rash appeared on my arm yesterday, it's a bit itchy"
    sessionId = "44444444-4444-4444-4444-444444444444"
} | ConvertTo-Json

$body | Out-File -Encoding utf8 request.json

curl.exe -X POST https://mracfdhnxewrigazlzbz.supabase.co/functions/v1/session-image `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer sb_publishable_8vwZmWgm4eWmvhRu_Anrmg_oLNds4_q" `
  --data-binary "@request.json"