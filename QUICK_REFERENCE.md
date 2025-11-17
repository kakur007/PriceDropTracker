# 🚀 Quick Reference - Price Drop Tracker

## 📂 Files Created

You now have 3 essential documents:

| File | Purpose |
|------|---------|
| **README.md** | Quick start guide and overview |
| **PROJECT_BUILD_GUIDE.md** | Sessions 1-6 (Foundation & Backend) |
| **PROJECT_BUILD_GUIDE_PART2.md** | Sessions 7-13 (UI & Launch) |

## ⚡ Quick Start Commands

```bash
# 1. Initialize git
git init
git add .
git commit -m "Add complete build guide"

# 2. Create GitHub repo at github.com/new
# Name it: price-drop-tracker

# 3. Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/price-drop-tracker.git
git branch -M main
git push -u origin main

# 4. Now ready for Claude Code!
```

## 🎯 Build Sessions at a Glance

| # | Time | What You Build |
|---|------|----------------|
| 1 | 30m | Project setup, manifest.json |
| 2 | 1h | Currency parser (CRITICAL foundation) |
| 3 | 1.5h | Product detection system |
| 4 | 45m | Storage management |
| 5 | 1.5h | Site adapters (Amazon, eBay, etc.) |
| 6 | 2h | Background price checker |
| 7 | 45m | Notifications |
| 8 | 2h | Popup UI |
| 9 | 1h | Settings page |
| 10 | 30m | Wire everything together |
| 11 | 2h | Testing |
| 12 | 1h | Polish & bugs |
| 13 | 2h | Chrome Web Store prep |

**Total: ~15 hours of development**

## 🔑 Key Technical Decisions

### Why These Choices Were Made

| Decision | Reason |
|----------|--------|
| Manifest V3 | Required by Chrome, future-proof |
| ES6 Modules | Clean, modern, maintainable code |
| Chrome Storage API | Simple, reliable, built-in |
| No external libraries | Smaller size, fewer dependencies |
| Currency parsing first | Foundation for all other features |
| Site-specific adapters | Better reliability than generic scraping |
| Local storage only | Privacy-first, no server costs |

### Critical Order Dependencies

**Must do Session 2 before Session 3!**
- Session 2 (Currency parser) is used by Session 3 (Product detection)
- Can't detect products without parsing prices
- Can't parse prices without currency data

**Background script needs storage**
- Session 4 (Storage) before Session 6 (Background)

**UI needs data layer**
- Sessions 1-6 before Sessions 7-9

## 🎨 Extension Architecture

```
┌─────────────────┐
│  Content Script │  (Runs on product pages)
│  - Detect products
│  - Extract prices
│  - Show badges
└────────┬────────┘
         │
         ↓ Message
┌─────────────────────┐
│  Service Worker     │  (Background)
│  - Store products
│  - Schedule checks
│  - Check prices
│  - Send notifications
└─────────┬───────────┘
          │
          ↓ Data
┌─────────────────────┐
│  Chrome Storage     │  (Local)
│  - Products
│  - Settings
│  - Metadata
└─────────────────────┘
          ↑
          │ Read
┌─────────┴───────────┐
│  Popup UI           │  (User interface)
│  - Show products
│  - Filter/sort
│  - Actions
└─────────────────────┘
```

## 🔥 Most Important Prompts

### Session 2 - Currency Parser (CRITICAL!)
This is the **most important session**. Get this right first.

```
Key requirements:
- Handle 30+ currencies
- Parse formats: $99.99, 99,99 €, £1,299.99, ¥9,999
- Detect from symbols, ISO codes, and context
- Return confidence scores
- Normalize to decimal point
```

### Session 3 - Product Detection
Multi-layer fallback ensures reliability.

```
Detection priority:
1. Schema.org (95% confidence)
2. Open Graph (85% confidence)
3. Microdata (75% confidence)
4. CSS selectors (65% confidence)
```

### Session 6 - Price Checker
Critical for reliability.

```
Must include:
- Rate limiting (10 req/min)
- Batch processing (5 at a time)
- Retry logic (3 attempts)
- Error handling (mark stale after 3 fails)
- Currency validation
```

## 🐛 Common Pitfalls to Avoid

### 1. Currency Mismatch
**Problem**: Comparing prices in different currencies
**Solution**: Always check currency matches before comparing

### 2. Rate Limiting
**Problem**: Too many requests → IP blocked
**Solution**: Use RateLimiter class, batch requests, add delays

### 3. Site Changes
**Problem**: CSS selectors break when sites update
**Solution**: Multi-layer detection with fallbacks

### 4. Storage Overflow
**Problem**: Extension crashes when storage full
**Solution**: Limit products, cleanup old entries, compress images

### 5. Permission Rejection
**Problem**: Chrome Web Store rejects for excessive permissions
**Solution**: Start with specific domains, explain in detail

## 📊 Success Criteria

### Before Submitting to Store

- [ ] Detects products on 20+ test URLs
- [ ] Accuracy: >90% correct price extraction
- [ ] All 30+ currencies parse correctly
- [ ] Background checks complete in <5min for 100 products
- [ ] Memory usage <50MB
- [ ] No console errors
- [ ] All manual tests pass
- [ ] Privacy policy published

### After Launch

- Track these metrics:
  - Detection accuracy
  - Price check success rate
  - User retention (30-day)
  - Average products tracked per user
  - Store rating (target: >4.0 stars)

## 🎓 Skills You'll Learn

By completing this project:

- ✅ Chrome Extension development (Manifest V3)
- ✅ Content scripts and messaging
- ✅ Background service workers
- ✅ Chrome APIs (Storage, Alarms, Notifications)
- ✅ Web scraping and parsing
- ✅ Multi-currency handling
- ✅ Rate limiting and batching
- ✅ Error handling at scale
- ✅ UI/UX design
- ✅ Testing strategies
- ✅ Chrome Web Store submission

## 💡 Pro Tips

### Development
1. **Test incrementally** - Don't build everything before testing
2. **Use console.log liberally** - Remove before production
3. **Keep DevTools open** - Monitor for errors constantly
4. **Test on real sites** - Don't rely on test data only

### AI Prompting
1. **Be specific** - Copy prompts exactly from build guide
2. **Provide context** - Share error messages with full stack trace
3. **Test immediately** - Verify each feature before moving on
4. **Keep iterating** - If something doesn't work, ask for refinement

### Chrome Web Store
1. **Start with specific domains** - Easier approval than `<all_urls>`
2. **Explain thoroughly** - Detailed permission justifications
3. **Professional assets** - High-quality icons and screenshots
4. **Clear privacy policy** - Hosted on real website
5. **Be patient** - First review takes 1-3 days

## 🚨 Critical Reminders

### For Development
- **Currency parsing MUST work** - Everything depends on it
- **Rate limiting is mandatory** - Or sites will block you
- **Error handling everywhere** - Extension must never crash
- **Test across currencies** - USD is not enough

### For Submission
- **Privacy policy required** - Must be on real website
- **Screenshots mandatory** - Need at least 1, recommend 5
- **Permission justification** - Explain every permission clearly
- **No external calls** - Except to product pages for checking

### For Maintenance
- **Sites change constantly** - Monitor for broken detection
- **Update adapters monthly** - CSS selectors break often
- **Respond to reviews** - Engaged developers get better ratings
- **Release updates regularly** - Shows active maintenance

## 📞 Getting Help

### During Development
1. Re-read the relevant session in the build guide
2. Check the examples provided
3. Review the testing section
4. Provide Claude Code with context from guide

### After Launch
1. Monitor Chrome Web Store reviews
2. Check GitHub issues
3. Look for common patterns in bug reports
4. Update documentation

## 🎯 Success Path

```
Week 1: Sessions 1-6  → Core functionality working
Week 2: Sessions 7-9  → UI complete
Week 3: Sessions 10-12 → Tested and polished
Week 4: Session 13     → Submitted to store

Day 1-3: Review process
Day 4: LAUNCH! 🚀
```

## 📈 Post-Launch Roadmap

### Phase 1 (Month 1-3)
- Monitor and fix bugs
- Respond to user feedback
- Update site adapters as needed
- Gather feature requests

### Phase 2 (Month 4-6)
- Add 5-10 more stores
- Implement currency conversion
- Add price history graphs
- Improve UI based on feedback

### Phase 3 (Month 7-12)
- Add price prediction
- Implement AI recommendations
- Mobile companion app
- Premium tier (optional)

## ✅ Pre-Flight Checklist

Before starting development:
- [ ] Read README.md
- [ ] Skim both build guide documents
- [ ] Understand the architecture
- [ ] Have Chrome installed
- [ ] Have text editor ready
- [ ] Git repository initialized
- [ ] GitHub account ready
- [ ] Time allocated (~15 hours)

Before submission:
- [ ] All 90+ manual tests pass
- [ ] Privacy policy published
- [ ] Store assets created
- [ ] Listing text written
- [ ] Developer account ready ($5 fee)
- [ ] Confident in code quality

## 🎉 You're Ready!

Everything you need is in:
1. **README.md** - Start here
2. **PROJECT_BUILD_GUIDE.md** - Sessions 1-6
3. **PROJECT_BUILD_GUIDE_PART2.md** - Sessions 7-13

**Next step**: Push to GitHub and start with Session 1.

**Remember**: The prompts are written to work perfectly with AI assistants like Claude Code. Trust the process!

---

Good luck! You've got this! 💪🚀
