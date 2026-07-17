# Chat App Backend — Foundation

## Run
```bash
npm install
cp .env.example .env   # values fill karo
npm run dev
```

## What's New

- **Error handling**: `errorHandler(res, error.statusCode, ...)` pattern hata diya — ab `ApiError` class + global `errorMiddleware` hai jo Mongoose validation, duplicate-key, aur JWT errors ko bhi automatically handle karta hai. Pehle generic errors mein `statusCode` undefined hota tha.
- **Validation**: Manual if-else chains hata ke Zod schemas + `validate` middleware.
- **Auth**: Access token (15m) + Refresh token (7d), dono httpOnly cookies mein. `/api/auth/refresh` route naya hai jo access token expire hone pe frontend silently call karega.
- **Password**: `select: false` — ab koi bhi `User.find()` accidentally password expose nahi karega.
- **updateProfile bug fix**: `proflePic` typo tha (missing 'i'), fix kiya — `profilePic`.
- **Message model**: `delivered` boolean field jo controller use kar raha tha but schema mein tha hi nahi — hata diya, ab sirf `status` enum (`sent/delivered/seen`) single source of truth hai.
- **Rate limiting**: Auth routes pe strict (10 req / 15 min), baaki API pe loose.
- **Sockets**: Alag `sockets/` module — `userSocketMap` ab a `Map`, online users broadcast clean.

## Structure
```
src/
├── config/       # env, db, cloudinary
├── models/       # user, message
├── controllers/  # auth (message/search agle phase mein)
├── routes/
├── middleware/   # auth, error, rateLimiter, validate
├── validators/   # zod schemas
├── sockets/      # socket.io logic
└── utils/        # ApiError, ApiResponse, asyncHandler, tokens
```

## Controllers
- `message.controller.js` + `message.routes.js` (send/get, typing, read receipts via socket)
- `search.controller.js` (bug-fixed version of purane searchEverything)
- Frontend: Tailwind design system + Redux slices update (naye `/refresh` flow ke hisaab se axios interceptor)
