# QR landing page

The permanent printed URL is `https://raddadband.com/tap/`. Keep it stable. Current promotional items use printed QR stickers, not NFC hardware. `/tap/` and legacy `/nfc/` aliases converge on `/qr/`, preserving query strings and fragments in their JavaScript and Worker redirect paths. Without JavaScript, static meta refresh and a normal link still reach the music page.

The current `/qr/` page is music-first and evergreen. It identifies Rad Dad as a DFW cover band and labels The Story Of Us a **Taylor Swift cover**. The linked streaming recording is released under Jeff Story; neither the composition nor the recording is described as a Rad Dad original.

The page retains all five current live-video URLs and existing direct-only versus inline-player distinctions. Apple Music's optional preview is loaded only after a click. Normal Apple Music, Amazon Music and YouTube links work without JavaScript. Header and footer socials use the same account URLs as the homepage.

No upcoming date is invented. The show area links back to the main site's show updates and history. Expired flyers, directions, calendar invitations and running-order links are no longer promoted here. Legacy `#song`, `#wildflower`, `#next-show`, `#follow` and `#join-show` fragments still resolve.

Both public pages use the root `styles.css`, shared evergreen overrides at `qr/styles.css`, the shared `script.js` and `live-video.js`. The old QR reveal script and September show-state controller are not loaded. See [the evergreen assessment](EVERGREEN_AUDIT.md) and [production deployment runbook](production-deployment.md) for testing and publication boundaries.
