# Manual Testing Checklist

## Setup
- [ ] Extension loaded in Chrome
- [ ] All permissions granted
- [ ] No console errors on load

## Product Detection Tests

### Amazon
- [ ] Visit Amazon.com product page
- [ ] Price detected correctly (USD)
- [ ] Title extracted
- [ ] Image loaded
- [ ] Tracking badge appears
- [ ] Product saved to storage
- [ ] Visit Amazon.co.uk product
- [ ] Currency correctly detected as GBP
- [ ] Visit Amazon.de product
- [ ] Currency correctly detected as EUR
- [ ] Visit Amazon.co.jp product
- [ ] Currency correctly detected as JPY (no decimals)

### eBay
- [ ] Visit eBay.com product page
- [ ] Price detected correctly
- [ ] Product tracked

### Walmart
- [ ] Visit Walmart product page
- [ ] Detection works

### Target
- [ ] Visit Target product page
- [ ] Detection works

### Best Buy
- [ ] Visit Best Buy product page
- [ ] Detection works

## Currency Parsing Tests
- [ ] US format: $1,299.99 → 1299.99 USD
- [ ] EU format: 1.299,99 € → 1299.99 EUR
- [ ] UK format: £1,299.99 → 1299.99 GBP
- [ ] JP format: ¥9,999 → 9999 JPY
- [ ] Nordic format: 1 299,99 kr → 1299.99 SEK

## Background Price Checking
- [ ] Set check interval to 3 hours
- [ ] Manually trigger check: chrome.alarms.create('priceCheck', {delayInMinutes: 0.1})
- [ ] Watch service worker console for check progress
- [ ] Verify prices update in storage
- [ ] Verify failed checks are logged
- [ ] Verify stale products marked after 3 failures

## Notifications
- [ ] Enable notifications in settings
- [ ] Manually change a product price (edit storage)
- [ ] Trigger price check
- [ ] Notification appears for price drop
- [ ] Click notification opens product page
- [ ] Notification respects min drop percentage setting
- [ ] Notification respects max per day limit

## Popup UI
- [ ] Click extension icon
- [ ] Products display correctly
- [ ] Images load
- [ ] Prices format correctly per currency
- [ ] Price drops show in green
- [ ] Filter tabs work (All, Price Drops, Expiring Soon)
- [ ] Visit button opens product page
- [ ] Delete button removes product
- [ ] Refresh button triggers price check
- [ ] Settings button opens settings page
- [ ] Stats update correctly
- [ ] Empty state shows when no products
- [ ] Loading state shows during fetch

## Settings Page
- [ ] Right-click extension → Options
- [ ] All settings load correctly
- [ ] Change tracking duration → saves
- [ ] Change max products → saves
- [ ] Change check interval → saves & updates alarm
- [ ] Toggle notifications → saves
- [ ] Change min drop % → saves
- [ ] Change max notifications/day → saves
- [ ] Export data downloads JSON file
- [ ] Import data restores from JSON
- [ ] Clear data removes all (with confirmation)
- [ ] Storage stats display correctly
- [ ] Check now button works

## Edge Cases
- [ ] Non-product pages don't trigger detection
- [ ] Shopping cart pages ignored
- [ ] Search results pages ignored
- [ ] Product with no image handles gracefully
- [ ] Product with very long title truncates
- [ ] Product price changes currency → handles gracefully
- [ ] Product goes out of stock → marks as stale
- [ ] Product page 404 → marks as stale
- [ ] Rate limiting doesn't crash extension
- [ ] Storage quota warning appears at 90%

## Performance
- [ ] Extension memory < 50MB with 100 products
- [ ] Popup opens in < 500ms
- [ ] Background checks complete in < 5min for 100 products
- [ ] No UI freezing or lag
- [ ] Content script doesn't slow page load

## Cross-Browser Compatibility (if supporting)
- [ ] Works in Chrome
- [ ] Works in Edge
- [ ] Works in Brave

## Final Checks
- [ ] No console errors anywhere
- [ ] All features work as expected
- [ ] Privacy: no external network calls except product pages
- [ ] Privacy: no tracking or analytics
- [ ] User data stays local
- [ ] Extension can be uninstalled cleanly
