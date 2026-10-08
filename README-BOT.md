# AtsX Telegram Approve / Reject Bot

ဒီ version က Topup Order ကို Telegram `@AtsX7_bot` ကနေ **Approve / Reject** လုပ်နိုင်အောင် server ပါထည့်ထားပါတယ်။

## အရေးကြီး
Screenshot ထဲမှာ Bot Token ပေါ်နေပြီးသားဖြစ်လို့ **အဲဒီ token ကို မသုံးပါနဲ့**။ BotFather → `/mybots` → `AtsX` → **API Token** → **Revoke current token** လုပ်ပြီး token အသစ်ထုတ်ပါ။

## 1) Server install
```bash
npm install
```

## 2) Environment
`.env.example` ကို `.env` အဖြစ် copy လုပ်ပြီး:
```env
BOT_TOKEN=NEW_TOKEN_FROM_BOTFATHER
ADMIN_CHAT_ID=YOUR_TELEGRAM_CHAT_ID
ADMIN_API_KEY=YOUR_RANDOM_ADMIN_API_KEY
PORT=3000
```

## 3) Telegram Chat ID ရယူရန်
Server ကို run ပြီး `@AtsX7_bot` ကို `/id` ပို့ပါ။ Bot က သင့် chat ID ပြန်ပေးပါမယ်။ အဲဒီနံပါတ်ကို `ADMIN_CHAT_ID` ထဲထည့်ပြီး server restart လုပ်ပါ။

## 4) Run
```bash
npm start
```

Website ကို server ကနေ `http://YOUR-DOMAIN/` ဖြင့်ဖွင့်ပါ။ Static hosting (GitHub Pages စသည်) တစ်ခုတည်းနဲ့ Bot approve/reject မရပါ။ Node.js server/hosting လိုပါတယ်။

## Flow
1. User က topup slip တင်သည်
2. Server က order သိမ်းပြီး Telegram admin chat ကို notification + slip ပို့သည်
3. Telegram မှ `✅ Approve` နှိပ်လျှင် user balance တိုးသည်
4. `❌ Reject` နှိပ်လျှင် order rejected ဖြစ်သည်
5. Website ပြန်ဖွင့်/refresh လုပ်သောအခါ server balance ကို sync လုပ်သည်

Admin Dashboard မှ server Approve/Reject ကိုသုံးမယ်ဆိုရင် `ADMIN_API_KEY` ကို prompt တောင်းပါမယ်။ Telegram Bot Approve/Reject ကတော့ Telegram admin chat ID နဲ့ပဲ authorization စစ်ပါတယ်။
