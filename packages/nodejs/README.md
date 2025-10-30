# Node.js + Express FHEVM Demo

Node.js and Express server serving a static FHE Counter demo using `uni-fhevm-sdk`.

## Features

- Express server serving static files
- Same UI/UX as vanilla demo
- Plug-and-play `uni-fhevm-sdk` integration
- Wallet connection with MetaMask
- FHE Counter with encrypt/decrypt operations

## Installation

```bash
npm install
```

## Run

```bash
npm run dev
```

Server runs at `http://localhost:3100`

## Structure

```
nodejs-fhevm-demo/
├── server.js          # Express server
├── public/
│   ├── index.html     # Main HTML
│   ├── style.css      # Styles (same as vanilla demo)
│   └── app.js         # Frontend logic (same as vanilla demo)
└── package.json
```

## How It Works

1. Express serves static files from `public/` directory
2. Frontend uses `uni-fhevm-sdk` directly in browser
3. SDK handles FHEVM initialization, encryption, and decryption
4. Same workflow as other demos (React, Vue, Vanilla)
