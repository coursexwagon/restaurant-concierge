<!-- LOGO -->
<div align="center">
  <img src="https://img.shields.io/badge/Restaurant-Concierge-AI-red?logo=openai&style=for-the-badge" alt="Logo">
  <h1>🤖 Restaurant Concierge Agent</h1>
  <p>Your AI-powered restaurant assistant that handles orders, bookings & customer queries 24/7</p>
</div>

---

<!-- BADGES -->
<div align="center">
  <img src="https://img.shields.io/github/stars/coursexwagon/restaurant-concierge" alt="Stars">
  <img src="https://img.shields.io/github/forks/coursexwagon/restaurant-concierge" alt="Forks">
  <img src="https://img.shields.io/github/issues/coursexwagon/restaurant-concierge" alt="Issues">
  <img src="https://img.shields.io/github/license/coursexwagon/restaurant-concierge" alt="License">
  <img src="https://img.shields.io/node-version/18.x" alt="Node Version">
</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🧠 **Everlasting Memory** | Remembers customers forever until deleted |
| ⚡ **Skills System** | Create, import, export skills |
| 🔒 **High Security** | AES-256 encryption for API keys |
| 🌐 **Browser Setup** | Configure everything in browser - no terminal needed |
| 📱 **Multi-Platform** | Works on Windows, Mac, Linux, Termux |
| 💬 **WhatsApp** | Connect your business WhatsApp |
| 🌐 **Web Widget** | Embed on your website |
| 📊 **Dashboard** | Monitor everything in real-time |
| 🧑‍🏫 **Training** | Teach your agent new things |
| 🔗 **Data Sources** | Connect to website, API, database |

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/coursexwagon/restaurant-concierge.git

# 2. Enter directory
cd restaurant-concierge

# 3. Install dependencies
npm install

# 4. Start the agent
npm run dev
```

Then open **<http://localhost:3000/setup.html>** in your browser!

---

## 📖 Setup Guide

### Step 1: Start the Agent

Run this in your terminal:

```bash
npm run dev
```

### Step 2: Open Setup

Open your browser and go to:

```
http://localhost:3000/setup.html
```

### Step 3: Configure

Fill in your details:

- Business name & type
- AI provider (OpenRouter recommended - has free models!)
- API key (encrypted for security)
- Channels (WhatsApp, Web, Dashboard)

### Step 4: Launch

Click "Launch Agent" and your AI concierge is live!

---

## 🔧 Configuration Options

### AI Providers

| Provider | Free Models | Notes |
|----------|------------|-------|
| **OpenRouter** | Yes (300+) | Recommended - free tier available |
| Ollama | Yes | Run locally |
| OpenAI | No | GPT-4o |
| Anthropic | No | Claude |

### Environment Variables

Create a `.env` file:

```bash
# Required
LLM_PROVIDER=openrouter
OPENAI_API_KEY=your-key-here

# Optional
DASHBOARD_PORT=3000
OWNER_PHONE=+27xxxxxxxxx
```

---

## 📁 Project Structure

```
restaurant-concierge/
├── src/
│   ├── agent/          # AI brain
│   ├── channels/       # WhatsApp, Telegram
│   ├── dashboard/     # Web dashboard
│   ├── gateway/       # WebSocket server
│   ├── knowledge/     # RAG & web scraping
│   ├── memory/        # Everlasting memory
│   ├── skills/        # Skill management
│   └── orders/        # Order management
├── config/            # Configuration files
├── skills/            # Built-in skills
└── package.json
```

---

## 🎯 Use Cases

- 🍽️ **Restaurant**: Take orders, handle reservations
- 💅 **Salon**: Book appointments, manage clients
- 🏨 **B&B**: Check-in guests, answer questions
- 🛒 **Retail**: Product queries, track orders

---

## 🔐 Security

- API keys encrypted with AES-256 at rest
- No customer data leaves your device
- Prompt injection protection
- Rate limiting built-in

---

## 📝 License

MIT License - feel free to use for your business!

---

## 🆘 Support

Having issues? Check the [Issues](https://github.com/coursexwagon/restaurant-concierge/issues) page.

---

<div align="center">
  <p>Made with ❤️ for restaurants everywhere</p>
  <p>Star ⭐ if this helps!</p>
</div>
