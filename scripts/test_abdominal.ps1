$body = @{
    text = "I have a moderate stomach ache that has been persistent for 3 days"
    sessionId = "66666666-6666-6666-6666-666666666666"
} | ConvertTo-Json

$body | Out-File -Encoding utf8 request3.json

curl.exe -X POST https://mracfdhnxewrigazlzbz.supabase.co/functions/v1/session-message `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer sb_publishable_8vwZmWgm4eWmvhRu_Anrmg_oLNds4_q" `
  --data-binary "@request3.json"