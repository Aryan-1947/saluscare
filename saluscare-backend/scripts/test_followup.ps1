$body = @{
    text = "My sore throat has gotten worse and now I also have a fever"
    parentSessionId = "11111111-1111-1111-1111-111111111111"
    newSessionId = "77777777-7777-7777-7777-777777777777"
} | ConvertTo-Json

$body | Out-File -Encoding utf8 request4.json

curl.exe -X POST https://mracfdhnxewrigazlzbz.supabase.co/functions/v1/session-followup `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer sb_publishable_8vwZmWgm4eWmvhRu_Anrmg_oLNds4_q" `
  --data-binary "@request4.json"