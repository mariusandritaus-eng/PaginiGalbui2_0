# AI Agent Prompt for Efficient Setup

When user says "set up the application" or similar, use this **minimal token approach**:

## 🎯 Single Command Setup (Most Efficient)

```bash
cd /app && mkdir -p uploads && chmod 755 uploads && \
echo -e "MONGO_URL=mongodb://localhost:27017\nDB_NAME=forensics_db\nCORS_ORIGINS=*\nADMIN_USERNAME=admin\nADMIN_PASSWORD=dcco2024" > backend/.env && \
echo "REACT_APP_BACKEND_URL=/api" > frontend/.env && \
cd backend && pip install -r requirements.txt > /tmp/backend_install.log 2>&1 && \
cd ../frontend && yarn install > /tmp/frontend_install.log 2>&1 && \
sudo supervisorctl restart all && sleep 35 && sudo supervisorctl status && \
curl -s http://localhost:8001/api/stats
```

**Total tool calls needed: 1 bash command + 1 verification = 2 calls**

---

## 📋 Verification (1 tool call)

```bash
echo "=== Services ===" && sudo supervisorctl status && \
echo -e "\n=== Backend ===" && curl -s http://localhost:8001/api/ && \
echo -e "\n=== Stats ===" && curl -s http://localhost:8001/api/stats && \
echo -e "\n=== Frontend ===" && curl -I http://localhost:3000 2>&1 | head -1
```

---

## 🔄 Daily Operations (Efficient Commands)

### Quick Status Check (1 call)
```bash
sudo supervisorctl status && curl -s http://localhost:8001/api/stats
```

### Restart All (1 call)
```bash
sudo supervisorctl restart all && sleep 10 && sudo supervisorctl status
```

### View Recent Logs (1 call)
```bash
echo "=== Backend Logs ===" && tail -20 /var/log/supervisor/backend.err.log && \
echo -e "\n=== Frontend Status ===" && tail -10 /var/log/supervisor/frontend.out.log | grep -E "(Compiled|error)"
```

### Complete Health Check (1 call)
```bash
echo "Services:" && sudo supervisorctl status | grep -E "(backend|frontend|mongodb)" && \
echo -e "\nBackend:" && curl -s http://localhost:8001/api/ && \
echo -e "\nDatabase:" && curl -s http://localhost:8001/api/stats && \
echo -e "\nFrontend:" && curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000
```

---

## 🎯 Token Optimization Tips

### DO ✅
- Combine multiple commands with `&&` in single bash call
- Use `sleep X && command` instead of multiple waiting calls
- Pipe outputs through grep/tail to reduce output size
- Redirect verbose installs to log files: `> /tmp/install.log 2>&1`
- Use `curl -s` (silent) to reduce output
- Use `head -N` or `tail -N` to limit output lines

### DON'T ❌
- Don't call separate bash commands for each step
- Don't view entire large files (use tail/head)
- Don't repeatedly check status in loop
- Don't install packages one by one
- Don't restart services multiple times

---

## 📝 Example: Efficient Setup Flow

**Instead of 15+ tool calls, use 3 total:**

1. **Setup command** (1 call):
```bash
bash /app/quick_setup.sh 2>&1 | tail -30
```

2. **Verify** (1 call):
```bash
sudo supervisorctl status && curl -s http://localhost:8001/api/stats
```

3. **Done!** Tell user with finish tool (1 call)

---

## 🚀 Pre-Made Script

Just run:
```bash
bash /app/quick_setup.sh
```

This handles everything in one execution:
- Creates directories
- Creates .env files
- Installs dependencies
- Restarts services
- Verifies setup

**Total time: ~2 minutes**  
**Total tokens: Minimal (single script execution)**

---

## 💡 Advanced: One-Line Complete Setup + Verify

```bash
cd /app && \
bash quick_setup.sh 2>&1 | tail -40 && \
echo -e "\n=== VERIFICATION ===" && \
sudo supervisorctl status && \
curl -s http://localhost:8001/api/ && \
curl -s http://localhost:8001/api/stats
```

**Everything in ONE tool call!**

---

## 🎓 Learning from This Setup

**Before (inefficient):**
- 5 calls to create individual files
- 3 calls for installations
- 5 calls for status checks
- 3 calls for verification
- **Total: 16+ calls = High token usage**

**After (efficient):**
- 1 call for complete setup script
- 1 call for verification
- **Total: 2 calls = Minimal tokens**

**Savings: ~87% reduction in tool calls**

---

## 📖 Documentation Location

All commands documented in: `/app/EMERGENT_QUICK_SETUP.md`

For AI agents: Read once, use commands directly without explanation.
