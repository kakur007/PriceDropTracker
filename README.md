# Price Drop Tracker - Quick Start Guide

## 📁 Project Files

Your complete build guide is split into two documents:

1. **PROJECT_BUILD_GUIDE.md** - Sessions 1-6 (Foundation & Core Features)
   - Project setup and manifest.json
   - Multi-currency support
   - Product detection system
   - Storage management
   - Site-specific adapters
   - Background service worker & price checking

2. **PROJECT_BUILD_GUIDE_PART2.md** - Sessions 7-13 (UI & Polish)
   - Notification system
   - Popup UI
   - Settings page
   - Integration & testing
   - Bug fixes & polish
   - Chrome Web Store submission

## 🚀 Getting Started with Claude Code

### Step 1: Push to GitHub

```bash
# Initialize git repository
cd C:\Users\Kasutaja\Documents\PriceDropTracker
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Complete build guide for Price Drop Tracker"

# Create GitHub repo at github.com/new
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/price-drop-tracker.git
git branch -M main
git push -u origin main
```

### Step 2: Use with Claude Code

Once pushed to GitHub, use these commands in Claude Code:

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/price-drop-tracker.git
cd price-drop-tracker

# Read the build guide
cat PROJECT_BUILD_GUIDE.md

# Start with Session 1
# Follow each session sequentially
```

## 📋 Build Order

Follow these sessions in order:

| Session | Time | Files Created | Description |
|---------|------|---------------|-------------|
| 1 | 30min | manifest.json, README, structure | Project foundation |
| 2 | 1hr | currency-data.js, currency-parser.js | Multi-currency support |
| 3 | 1.5hr | product-detector.js, price-extractor.js | Product detection |
| 4 | 45min | storage-manager.js | Data persistence |
| 5 | 1.5hr | Site adapters (Amazon, eBay, etc.) | Site-specific logic |
| 6 | 2hr | service-worker.js, price-checker.js | Background checking |
| 7 | 45min | notification-manager.js | Notifications |
| 8 | 2hr | popup.html/js/css | Extension popup |
| 9 | 1hr | settings.html/js/css | Settings page |
| 10 | 30min | Integration updates | Wire everything together |
| 11 | 2hr | Test files | Comprehensive testing |
| 12 | 1hr | Bug fixes | Polish and optimization |
| 13 | 2hr | Store assets | Chrome Web Store prep |

**Total Development Time: ~15 hours**

## 🎯 Key Features Implemented

- ✅ Automatic product detection on page load
- ✅ Multi-currency support (30+ currencies)
- ✅ Site-specific adapters for major stores
- ✅ Background price monitoring (every 3-24 hours)
- ✅ Price drop notifications
- ✅ Clean popup UI with filters
- ✅ Comprehensive settings page
- ✅ Data export/import
- ✅ 100% local storage (privacy-first)

## 🛠️ Technical Stack

- **Manifest**: V3
- **Language**: JavaScript (ES6 modules)
- **Storage**: Chrome Storage API (local)
- **Alarms**: Chrome Alarms API
- **Notifications**: Chrome Notifications API
- **Libraries**: None (vanilla JS)

## 🌐 Supported Sites

- Amazon (all regions: .com, .co.uk, .de, .fr, .it, .es, .ca, .com.au, .co.jp, .in)
- eBay (all regions)
- Walmart
- Target
- Best Buy

## 💡 AI Prompting Tips

When working with Claude Code on each session:

1. **Start each session with**: "Let's work on Session X: [Title]. I'll follow the prompts exactly as written in the build guide."

2. **For each task**: Copy the entire prompt from the build guide and provide it to Claude Code.

3. **After each file**: Test immediately using the provided testing instructions.

4. **If errors occur**: Share the error message and ask Claude Code to fix it using the context from the build guide.

5. **Keep track**: Check off completed tasks in the checklists.

## 🧪 Testing Strategy

### During Development (Sessions 1-10)
- Test each feature as you build it
- Use Chrome DevTools console
- Load unpacked extension frequently
- Verify in Chrome's extension management

### Before Submission (Sessions 11-12)
- Complete manual-test-checklist.md
- Test on 20+ real product pages
- Verify all currencies
- Check performance metrics
- Test error handling

### After Launch (Session 13+)
- Monitor user reviews
- Track error reports
- Update site adapters as needed
- Release updates regularly

## 📦 File Structure Reference

```
price-drop-tracker/
├── manifest.json                    # Extension config
├── README.md                        # Documentation
├── PROJECT_BUILD_GUIDE.md          # This guide (Part 1)
├── PROJECT_BUILD_GUIDE_PART2.md    # This guide (Part 2)
│
├── background/
│   ├── service-worker.js           # Main background logic
│   ├── price-checker.js            # Price checking
│   └── storage-manager.js          # Data management
│
├── content-scripts/
│   ├── product-detector.js         # Product detection
│   ├── price-extractor.js          # Price extraction
│   └── site-adapters/
│       ├── base-adapter.js         # Abstract adapter
│       ├── amazon.js               # Amazon logic
│       ├── ebay.js                 # eBay logic
│       ├── walmart.js              # Walmart logic
│       ├── target.js               # Target logic
│       └── bestbuy.js              # Best Buy logic
│
├── popup/
│   ├── popup.html                  # Popup UI
│   ├── popup.js                    # Popup logic
│   └── popup.css                   # Popup styles
│
├── options/
│   ├── settings.html               # Settings UI
│   ├── settings.js                 # Settings logic
│   └── settings.css                # Settings styles
│
├── utils/
│   ├── currency-data.js            # Currency definitions
│   ├── currency-parser.js          # Price parsing
│   ├── notification-manager.js     # Notifications
│   ├── product-hasher.js           # ID generation
│   └── fetch-helper.js             # Network utilities
│
├── assets/
│   ├── icons/                      # Extension icons
│   └── store/                      # Store assets
│
└── tests/
    ├── test-sites.json             # Test URLs
    ├── manual-test-checklist.md    # Testing guide
    └── currency-parser.test.js     # Unit tests
```

## 🔒 Privacy Commitment

This extension is designed with privacy as the #1 priority:

- ✅ All data stored locally
- ✅ No external servers
- ✅ No analytics or tracking
- ✅ No data collection
- ✅ Open source code
- ✅ Minimal permissions
- ✅ Transparent operation

## 🎓 Learning Outcomes

By completing this project, you'll learn:

- Chrome Extension Manifest V3 architecture
- Content scripts and background service workers
- Chrome Storage API
- Chrome Alarms API
- Chrome Notifications API
- Multi-currency handling
- Web scraping strategies
- Rate limiting and batching
- Error handling at scale
- User interface design
- Chrome Web Store submission process

## 🤝 Contributing

After launch, consider:

- Accepting community PRs for new site adapters
- Adding requested features
- Improving detection accuracy
- Supporting more currencies
- Expanding to more stores

## 📞 Support

For questions or issues during development:

1. **Re-read the build guide** - Most answers are in the detailed prompts
2. **Check the examples** - Each session has code examples
3. **Review the checklists** - Ensure all steps completed
4. **Test incrementally** - Don't build everything before testing
5. **Ask Claude Code** - Provide context from the build guide

## 🎉 Success Metrics

After launch, track:

- **Technical**: Detection accuracy >90%, Check success rate >95%
- **User**: Active users, Retention rate, Average products tracked
- **Quality**: Star rating >4.0, Bug reports, Feature requests

## 🚦 Current Status

- [x] Build guide completed
- [x] All sessions documented
- [x] Testing procedures defined
- [x] Chrome Web Store prep documented
- [ ] Development (your turn!)
- [ ] Testing
- [ ] Submission
- [ ] Launch

## 📅 Recommended Timeline

- **Week 1**: Sessions 1-6 (Core functionality)
- **Week 2**: Sessions 7-9 (UI and settings)
- **Week 3**: Sessions 10-12 (Integration, testing, polish)
- **Week 4**: Session 13 (Store submission and launch)

## 🎯 Next Steps

1. ✅ Push this guide to GitHub
2. → Clone in your development environment
3. → Open PROJECT_BUILD_GUIDE.md
4. → Start with Session 1
5. → Follow each prompt sequentially
6. → Test after each session
7. → Submit to Chrome Web Store
8. → Launch! 🚀

---

**Good luck with your development!**

Remember: The detailed prompts in the build guides are optimized for AI assistants like Claude Code. Follow them exactly for best results.

Questions? Issues? Open a GitHub issue or reach out via email.

**Let's build something amazing!** 💪
