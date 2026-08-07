# SafeFlight

Full-stack app to track your flights and follow friends' and family's trips,
with a live map and aviation weather. Making sure that everyone has a safe flight <3.


Tech stack: React + Vite client, Express + Passport (Google OAuth) API, PostgreSQL + Prisma.

## Features

- **Google sign-in** 
- **Flight tracking** 
- **Live flight map** (Leaflet)
- **Aviation weather** (.gov API)

## Architecture

```
safeflight/
├── client/                 
│   └── src/
│       ├── pages/          
│       ├── lib/geo.ts      
│       └── App.tsx         
├── server/                 
   ├── prisma/schema.prisma  
   └── src/
      ├── lib/           
      ├── middleware/     
      └── routes/         
```
