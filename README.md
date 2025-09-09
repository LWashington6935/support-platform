# Support Desk — AI-Assisted Customer Support Platform

> **Production-ready** customer support platform with AI-powered assistance, built for simplicity and scalability.

[![Node.js CI](https://github.com/your-org/support-desk/workflows/Node.js%20CI/badge.svg)](https://github.com/your-org/support-desk/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

🎯 **Dual Interface Design**

- **Agent Workspace** (`index.html`) — Ticket management, AI suggestions, analytics, dark mode
- **Customer Portal** (`portal.html`) — Self-service ticketing with secure email authentication

🤖 **AI-Powered Assistance**

- Smart reply suggestions using OpenAI GPT models
- Context-aware responses based on ticket history
- Regenerate suggestions with one click

📚 **Knowledge Base**

- Real-time search with autosuggest
- Category organization
- Integrated with ticket creation flow

📊 **Analytics & Insights**

- CSAT tracking and reporting
- Response time metrics
- Tag-based organization
- Visual dashboards

🛠 **Developer-Friendly**

- No build step required
- SQLite for zero-config development
- REST API with clear documentation
- Docker support included

-----

## 🚀 Quick Start

### **1. Setup Backend**

```bash
# Clone and install
git clone <your-repo-url> support-desk
cd support-desk
npm install

# Configure environment
cp .env.example .env
# Edit .env with your OpenAI API key
```

### **2. Environment Configuration**

```bash
# .env
PORT=4000
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini
DATABASE_FILE=./data/support.db
CORS_ORIGIN=*
```

### **3. Start the Application**

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start

# ✅ Server running at http://localhost:4000
```

### **4. Access the Interfaces**

**Option A: Direct File Access**

- **Agent Workspace**: Open `index.html` in your browser
- **Customer Portal**: Open `portal.html` in your browser

**Option B: Live Server (Recommended)**

```bash
# Using VS Code Live Server extension
# Right-click index.html → "Open with Live Server"

# Or using npx
npx serve .
# Visit http://localhost:3000/index.html
```

### **5. Verify Everything Works**

```bash
# Test API health
curl http://localhost:4000/api/tickets

# Create your first ticket
curl -X POST http://localhost:4000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Welcome to Support Desk!",
    "body": "This is your first ticket. AI suggestions should appear automatically.",
    "channel": "web",
    "requester": {"email": "demo@example.com", "name": "Demo User"}
  }'
```

-----

## 📁 Project Architecture

```
support-desk/
├── 📄 package.json                 # Node.js dependencies & scripts
├── 🔧 .env                        # Environment variables (add to .gitignore)
├── 📋 .env.example                # Template for environment setup
├── 🐳 docker-compose.yml          # Container orchestration
├── 📊 data/
│   └── support.db                 # SQLite database (auto-created)
├── ⚙️  src/
│   ├── server.js                  # Express app & main routes
│   ├── database.js                # SQLite connection & schema
│   ├── routes/
│   │   ├── tickets.js            # Ticket management endpoints
│   │   ├── kb.js                 # Knowledge base endpoints
│   │   └── analytics.js          # Reporting & metrics
│   ├── services/
│   │   ├── openai.js             # AI suggestion generation
│   │   └── email.js              # Email notifications (optional)
│   └── middleware/
│       ├── cors.js               # Cross-origin configuration
│       └── validation.js         # Request validation
├── 🎨 frontend/
│   ├── index.html                # Agent workspace interface
│   ├── portal.html               # Customer self-service portal
│   ├── assets/
│   │   ├── styles.css            # Custom styling
│   │   └── app.js                # Frontend JavaScript
│   └── components/               # Reusable UI components
├── 📚 docs/
│   ├── API.md                    # Complete API documentation
│   ├── DEPLOYMENT.md             # Production deployment guide
│   └── CONTRIBUTING.md           # Development guidelines
└── 🧪 tests/
    ├── api.test.js               # API endpoint tests
    └── integration.test.js       # End-to-end tests
```

-----

## 🔧 Configuration

### **Environment Variables**

|Variable        |Required|Default            |Description                                         |
|----------------|--------|-------------------|----------------------------------------------------|
|`PORT`          |No      |`4000`             |Server port number                                  |
|`OPENAI_API_KEY`|**Yes** |—                  |OpenAI API key for AI suggestions                   |
|`OPENAI_MODEL`  |No      |`gpt-4o-mini`      |GPT model (gpt-4o, gpt-4o-mini, gpt-3.5-turbo)      |
|`DATABASE_FILE` |No      |`./data/support.db`|SQLite database file path                           |
|`CORS_ORIGIN`   |No      |`*`                |Allowed origins (use specific domains in production)|
|`NODE_ENV`      |No      |`development`      |Environment mode                                    |
|`LOG_LEVEL`     |No      |`info`             |Logging verbosity (error, warn, info, debug)        |
|`EMAIL_ENABLED` |No      |`false`            |Enable email notifications                          |
|`SMTP_HOST`     |No      |—                  |SMTP server for email notifications                 |

### **Production Configuration Example**

```bash
# .env.production
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-proj-your-production-key
OPENAI_MODEL=gpt-4o
DATABASE_FILE=/data/support.db
CORS_ORIGIN=https://support.yourcompany.com,https://portal.yourcompany.com
LOG_LEVEL=warn
EMAIL_ENABLED=true
SMTP_HOST=smtp.yourcompany.com
```

-----

## 🌐 API Reference

### **Base URL**

```
http://localhost:4000/api
```

### **Authentication**

Currently using email-based customer authentication. Agent access is unrestricted for demo purposes.

### **Core Endpoints**

#### **Tickets**

**List Tickets**

```http
GET /api/tickets
```

**Create Ticket**

```http
POST /api/tickets
Content-Type: application/json

{
  "subject": "Need help with login",
  "body": "I can't remember my password and the reset link isn't working.",
  "channel": "web|email|chat|phone",
  "requester": {
    "email": "customer@example.com",
    "name": "Jane Doe"
  },
  "priority": "low|normal|high|urgent",
  "tags": ["login", "password-reset"]
}
```

**Get Ticket Details**

```http
GET /api/tickets/:id
GET /api/tickets/:id?refreshAi=1  # Regenerate AI suggestion
```

**Update Ticket Status**

```http
POST /api/tickets/:id/status
Content-Type: application/json

{
  "status": "new|open|pending|solved|closed",
  "agent_id": "optional-agent-identifier"
}
```

**Add Message to Ticket**

```http
POST /api/tickets/:id/messages
Content-Type: application/json

{
  "body": "Thanks for contacting us! I'll look into this right away.",
  "author_type": "agent|requester",
  "author_name": "Agent Smith",
  "is_internal": false
}
```

**Add Tags**

```http
POST /api/tickets/:id/tags
Content-Type: application/json

{
  "tag": "billing"
}
```

**Submit CSAT Rating**

```http
POST /api/tickets/:id/csat
Content-Type: application/json

{
  "rating": 5,
  "comment": "Excellent support! Very helpful and quick response."
}
```

#### **Knowledge Base**

**Search Articles**

```http
GET /api/kb/search?q=shipping&category=orders&limit=10
```

**Get Article**

```http
GET /api/kb/articles/:id
```

**Create Article** (Admin)

```http
POST /api/kb/articles
Content-Type: application/json

{
  "title": "How to Track Your Order",
  "body": "You can track your order by...",
  "category": "orders",
  "tags": ["tracking", "shipping", "orders"],
  "status": "published|draft",
  "author": "support-team"
}
```

#### **Analytics & Reporting**

**Get Dashboard Metrics**

```http
GET /api/analytics/dashboard
```

**Response:**

```json
{
  "tickets": {
    "total": 1247,
    "new": 23,
    "open": 45,
    "pending": 12,
    "solved": 1167
  },
  "csat": {
    "average": 4.2,
    "total_responses": 892,
    "distribution": {
      "1": 12, "2": 34, "3": 123, "4": 234, "5": 489
    }
  },
  "response_times": {
    "first_response_avg": "2h 34m",
    "resolution_avg": "1d 4h 12m"
  },
  "trends": {
    "last_7_days": [12, 15, 8, 22, 18, 25, 19],
    "last_30_days": [...],
    "top_tags": [
      {"tag": "billing", "count": 89},
      {"tag": "login", "count": 67}
    ]
  }
}
```

-----

## 🤖 AI Integration

### **How AI Suggestions Work**

1. **Automatic Generation**: When a ticket is created, the system analyzes the subject, body, and any initial context
1. **Context Awareness**: AI considers previous messages in the thread and similar resolved tickets
1. **Smart Caching**: Suggestions are cached to avoid regenerating identical requests
1. **Manual Refresh**: Agents can regenerate suggestions with new context

### **Customizing AI Behavior**

```javascript
// src/services/openai.js
const generateSuggestion = async (ticket, context = {}) => {
  const prompt = `
    As a helpful customer support agent, suggest a professional response to this ticket:
    
    Subject: ${ticket.subject}
    Customer Message: ${ticket.body}
    Previous Messages: ${context.messages || 'None'}
    
    Guidelines:
    - Be empathetic and professional
    - Provide actionable solutions
    - Ask clarifying questions if needed
    - Reference knowledge base articles when relevant
    
    Response:
  `;
  
  // OpenAI API call here
};
```

### **Supported Models**

|Model          |Speed  |Cost  |Best For                            |
|---------------|-------|------|------------------------------------|
|`gpt-4o`       |Slower |Higher|Complex issues, detailed analysis   |
|`gpt-4o-mini`  |Fast   |Lower |Quick responses, simple issues      |
|`gpt-3.5-turbo`|Fastest|Lowest|High-volume, straightforward support|

-----

## 📚 Knowledge Base Management

### **Adding Content**

**Via API:**

```bash
curl -X POST http://localhost:4000/api/kb/articles \
  -H "Content-Type: application/json" \
  -d '{
    "title": "How to Reset Your Password",
    "body": "To reset your password:\n1. Go to the login page\n2. Click \"Forgot Password\"\n3. Enter your email address\n4. Check your email for reset instructions",
    "category": "account",
    "tags": ["password", "login", "account"],
    "status": "published"
  }'
```

**Bulk Import:**

```bash
# Create seed-kb.js script
node scripts/seed-kb.js
```

### **Search Capabilities**

The knowledge base supports:

- **Full-text search** across titles and content
- **Category filtering** for organized browsing
- **Tag-based discovery** for related articles
- **Auto-suggest** as users type in the portal
- **Relevance scoring** for best matches first

### **Integration with Tickets**

- **Smart Suggestions**: KB articles automatically suggested based on ticket content
- **Quick Insert**: Agents can insert KB article links directly into responses
- **Analytics**: Track which articles are most helpful for deflection

-----

## 🔧 Development

### **Running in Development**

```bash
# Start with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### **Database Schema**

```sql
-- Core tables
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  priority TEXT DEFAULT 'normal',
  channel TEXT DEFAULT 'web',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ai_suggestion TEXT,
  requester_email TEXT NOT NULL,
  requester_name TEXT,
  assigned_agent TEXT,
  resolution_time INTEGER,
  first_response_time INTEGER
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  author_type TEXT NOT NULL, -- 'agent' or 'requester'
  author_name TEXT,
  is_internal BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets (id)
);

CREATE TABLE kb_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  tags TEXT, -- JSON array
  status TEXT DEFAULT 'published',
  author TEXT,
  views INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **Adding New Features**

1. **API Endpoints**: Add routes in `src/routes/`
1. **Database Changes**: Update `src/database.js`
1. **Frontend**: Modify `index.html` or `portal.html`
1. **Tests**: Add test cases in `tests/`

### **Testing**

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Test coverage
npm run test:coverage

# Manual testing with sample data
npm run seed:dev
```

-----

## 🚀 Deployment

### **Docker Deployment**

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN mkdir -p data

EXPOSE 4000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  support-desk:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DATABASE_FILE=/data/support.db
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    restart: unless-stopped
```

### **Platform Deployment**

**Render/Railway/Fly.io:**

```bash
# Set environment variables in platform dashboard
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-4o-mini
NODE_ENV=production
DATABASE_FILE=./data/support.db

# Deploy command
npm start
```

**Vercel (Serverless):**

```json
// vercel.json
{
  "version": 2,
  "builds": [
    { "src": "src/server.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/src/server.js" },
    { "src": "/(.*)", "dest": "/frontend/$1" }
  ]
}
```

### **Production Checklist**

- [ ] Set secure `CORS_ORIGIN` values
- [ ] Use production OpenAI API keys
- [ ] Configure persistent storage for SQLite
- [ ] Set up SSL/TLS certificates
- [ ] Configure logging and monitoring
- [ ] Set up automated backups
- [ ] Configure rate limiting
- [ ] Set up health check endpoints
- [ ] Configure error tracking (Sentry, etc.)
- [ ] Set up CI/CD pipeline

-----

## 📊 Analytics & Monitoring

### **Built-in Metrics**

The platform tracks:

- **Ticket Volume**: Daily, weekly, monthly trends
- **Response Times**: First response and resolution times
- **CSAT Scores**: Customer satisfaction ratings
- **Agent Performance**: Tickets handled, resolution rates
- **Channel Distribution**: Web, email, chat breakdown
- **Tag Analysis**: Most common issues and topics

### **Custom Dashboard**

```javascript
// Access metrics in frontend
const analytics = await fetch(`${API_ORIGIN}/api/analytics/dashboard`)
  .then(r => r.json());

// Display charts using Chart.js or similar
```

### **External Integration**

```javascript
// Export data for external analytics tools
GET /api/analytics/export?format=csv&start_date=2024-01-01&end_date=2024-12-31
```

-----

## 🛡️ Security Considerations

### **Current Implementation**

- Email-based customer authentication
- CORS configuration for API access
- Input validation on all endpoints
- SQL injection prevention using parameterized queries

### **Production Hardening**

```javascript
// Rate limiting
const rateLimit = require('express-rate-limit');
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  // Verify JWT token
  next();
};
```

### **Data Privacy**

- Customer emails are stored securely
- Support messages are retained per data retention policy
- OpenAI API calls use data processing agreements
- GDPR compliance features available

-----

## 🔍 Troubleshooting

### **Common Issues**

**❌ “Cannot connect to API”**

```bash
# Check if backend is running
curl http://localhost:4000/api/tickets

# Verify CORS settings
# Open browser dev tools → Network tab → check for CORS errors
```

**❌ “AI suggestions not appearing”**

```bash
# 1. Verify OpenAI API key
echo $OPENAI_API_KEY

# 2. Check logs for OpenAI errors
npm run dev
# Look for "OpenAI API Error" in console

# 3. Test API key directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 4. Try regenerating suggestion
# Click "Regenerate" button in agent interface
```

**❌ “Database locked error”**

```bash
# Stop all processes using the database
pkill node

# Check file permissions
ls -la data/support.db

# On Windows, ensure file isn't in OneDrive sync folder
```

**❌ “Frontend shows blank page”**

```bash
# Check browser console for JavaScript errors
# Common issues:
# - Mixed content (HTTP/HTTPS)
# - CORS blocking API calls
# - Missing Tailwind/Lucide CDN

# Test with simple HTTP server
npx serve . --single
```

### **Performance Issues**

**Slow AI suggestions:**

- Switch to faster model: `OPENAI_MODEL=gpt-3.5-turbo`
- Reduce prompt length
- Cache suggestions for similar tickets

**Database performance:**

```sql
-- Add indexes for common queries
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created ON tickets(created_at);
CREATE INDEX idx_messages_ticket ON messages(ticket_id);
```

### **Debug Mode**

```bash
# Enable detailed logging
DEBUG=support-desk:* npm run dev

# Database query logging
DEBUG=support-desk:db npm run dev

# OpenAI API logging
DEBUG=support-desk:ai npm run dev
```

-----

## 📈 Roadmap

### **Upcoming Features**

- [ ] **Real-time notifications** with WebSockets
- [ ] **File attachments** for tickets and KB articles
- [ ] **Advanced reporting** with custom date ranges
- [ ] **Multi-language support** for international teams
- [ ] **SLA management** with escalation rules
- [ ] **Integration APIs** for CRM and external tools
- [ ] **Mobile-responsive design** improvements
- [ ] **Advanced AI features** (sentiment analysis, auto-categorization)

### **Enterprise Features**

- [ ] **Single Sign-On (SSO)** integration
- [ ] **Role-based access control** for agents
- [ ] **White-label customization** options
- [ ] **Advanced security** features and compliance
- [ ] **Multi-tenant architecture** for hosting providers
- [ ] **API rate limiting** and usage analytics

-----

## 🤝 Contributing

We welcome contributions! Here’s how to get started:

### **Development Setup**

```bash
# 1. Fork the repository
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/support-desk.git

# 3. Install dependencies
npm install

# 4. Create a feature branch
git checkout -b feature/amazing-feature

# 5. Make your changes and test
npm run test
npm run lint

# 6. Commit and push
git commit -m "Add amazing feature"
git push origin feature/amazing-feature

# 7. Open a Pull Request
```

### **Contribution Guidelines**

- Follow existing code style (Prettier + ESLint configured)
- Add tests for new features
- Update documentation for API changes
- Keep commits focused and well-described
- Ensure all tests pass before submitting

### **Areas We Need Help With**

- 🎨 **UI/UX improvements** for mobile responsiveness
- 🔒 **Security reviews** and hardening
- 📚 **Documentation** and tutorial content
- 🌐 **Internationalization** (i18n) support
- 🧪 **Test coverage** improvements
- ⚡ **Performance optimization**

-----

## 📄 License

**MIT License** © 2024 Support Desk Contributors

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

-----

## 🙏 Acknowledgments

### **Built With**

- **Backend**: [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Frontend**: [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **AI**: [OpenAI API](https://openai.com/api/)
- **Deployment**: [Docker](https://docker.com/) + [Render](https://render.com/)

### **Inspiration**

- Zendesk for feature inspiration
- Freshdesk for UI patterns
- Linear for clean, fast interfaces
- Discord for real-time messaging concepts

-----

## 📞 Support & Community

**Need help?** We’re here for you:

- 📖 **Documentation**: Check our [Wiki](https://github.com/your-org/support-desk/wiki)
- 🐛 **Bug Reports**: [Open an issue](https://github.com/your-org/support-desk/issues/new?template=bug_report.md)
- 💡 **Feature Requests**: [Request a feature](https://github.com/your-org/support-desk/issues/new?template=feature_request.md)
- 💬 **Discussions**: [Join our community](https://github.com/your-org/support-desk/discussions)
- 📧 **Direct Contact**: support@yourcompany.com

**Community Links:**

- 🐦 **Twitter**: [@SupportDeskApp](https://twitter.com/SupportDeskApp)
- 💼 **LinkedIn**: [Support Desk](https://linkedin.com/company/support-desk)
- 📺 **YouTube**: [Setup tutorials and demos](https://youtube.com/channel/UC...)

-----

## 🎉 Getting Started Success!

Congratulations! You now have a **production-ready** support platform running locally.

**What’s Next?**

1. ⭐ **Star this repository** if it’s helpful
1. 🍴 **Fork it** to customize for your needs
1. 📢 **Share it** with your team
1. 🚀 **Deploy to production** and help your customers

**Pro Tips:**

- Start with the Wikipedia example to verify everything works
- Customize the AI prompts in `src/services/openai.js`
- Add your company branding to the HTML templates
- Set up monitoring and alerts for production

**Happy supporting!** 🎭✨

-----

*Made with ❤️ for customer success teams everywhere.*
