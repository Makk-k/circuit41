# Circuit41 — UI Breakdown
_Generated 2026-04-14. Based on full screen and component reads._

---

## Action-Colour System (standardised 2026-06-15)

Single source of truth: `lib/theme.ts` → `colors.primary` / `colors.accent` / `colors.danger`.

| Role | Colour | Use for |
|------|--------|---------|
| **Primary** | Black `#1A1712` (white text) | Continue, Submit, Save, Pay, Create, Next, Confirm — the dominant action button. |
| **Accent** | Orange `#CD643D` | **Sparingly:** selected states, active nav, small indicators, status highlights, progress, links. Never a primary-button or full-screen colour. |
| **Danger** | Red `#DC2626` | Errors, destructive/delete, cancel-shipment, warnings **only**. |
| **Secondary** | Neutral grey / soft fill / outline | Cancel (abort), low-emphasis actions. |

The old Circuit red `#C10F1D` is **retired** — do not reintroduce it anywhere.

---

## Global Design System

**Background:** `#F5F9F6` (soft off-white, used on every screen)  
**Card background:** `#FFFFFF`  
**Card border:** `#E2E0DA`  
**Primary text:** `#1A1A1A`  
**Secondary text:** `#6B6B6B`  
**Muted text:** `#A0A0A0`  
**Accent / primary action:** `#C10F1D` (deep red)  
**Font:** Plus Jakarta Sans (Regular 400, Medium 500, SemiBold 600, Bold 700)  
**Bottom tab bar:** `#222221` (near-black), height 80 + safe area bottom inset  

---

## Screens

---

### WelcomeScreen

**Background:** `#F7F6F0`  
**Layout:** SafeAreaView, flex column. Logo pinned top-left, headline fills middle flex space (aligned to bottom of middle section), actions block pinned to bottom.

**Sections (top to bottom):**
1. **Logo** — `circuit-logo.png`, 140×40, top-left
2. **Headline block** — pushed to bottom of middle flex area
   - `"Move goods.\nStay in control."` — 28px bold, `#1A1A1A`
   - `"Manage international shipments with full visibility."` — 13px regular, `#6B6B6B`
3. **Primary CTA button** — full-width, red `#C10F1D`, border-radius 12, "Continue with phone or email"
4. **Divider row** — horizontal lines with "or continue with" text in the middle
5. **Social buttons row** — two side-by-side white bordered buttons:
   - Apple button (black Apple logo icon) → shows "Coming Soon" alert (NOT implemented)
   - Google button (multicolour G icon) → triggers Google Sign-In flow, shows spinner while loading
6. **Terms text** — 10px muted, centered. "Terms" and "Privacy Policy" in red. No navigation attached.

**Buttons:**
- "Continue with phone or email" → navigates to PhoneEmail
- Apple → alert only
- Google → Google Sign-In → routes to ProfileSetup (new user) or MainTabs (returning user)

**Animations:** None  
**Header/Nav:** None (full-screen auth flow)

---

### PhoneEmailScreen

**Background:** `#F7F6F0`  
**Layout:** SafeAreaView → KeyboardAvoidingView → ScrollView. Keyboard-aware.

**Sections (top to bottom):**
1. **Back button** — circular grey background (`rgba(0,0,0,0.06)`), chevron-left SVG
2. **Title** — "Verify your phone or email" — 20px bold
3. **Subtitle** — "We'll send a one-time code to confirm" — 12px secondary
4. **Mode toggle** — pill-shaped segmented control (`#ECEAE4` background), "Phone" / "Email" tabs. Active tab gets white background card.
5. **Input field** — switches based on active mode:
   - **Phone mode:** single row card with country selector (flag + dial code + chevron-down) | vertical divider | phone number TextInput (phone-pad keyboard)
   - **Email mode:** full-width white bordered TextInput (email-address keyboard)
6. **"Send code" button** — full-width red, shows ActivityIndicator while sending
7. **Helper text** — "A 6-digit code will be sent to verify" — 10px muted, centered

**Inputs:**
- Phone number (phone-pad)
- Email address (email-address, no auto-capitalize)

**Buttons:**
- Back (chevron) → `navigation.goBack()`
- Country selector → opens CountryPickerModal (full-screen slide-up)
- Phone/Email toggle → switches input mode, clears value
- "Send code" → calls Supabase OTP, navigates to Verification

**Country Picker Modal** (triggered from phone mode):
- Full-screen slide-up modal, `#F7F6F0` background
- Header: "Select country code" + X close button (circular `#F0EEE8`)
- FlatList of 12 countries: flag emoji + dial code (bold) + country name + red checkmark on selected
- Tapping a row selects it and closes modal

**Animations:** None  
**Header/Nav:** Manual back button only (no nav bar)

---

### VerificationScreen

**Background:** `#F7F6F0`  
**Layout:** SafeAreaView → KeyboardAvoidingView → ScrollView. Keyboard-aware.

**Sections (top to bottom):**
1. **Back button** — circular grey, chevron-left
2. **Title** — "Enter the code" — 20px bold
3. **Subtitle** — "Sent to [contact]" — contact highlighted in bold `#1A1A1A`
4. **OTP input boxes** — 6 individual TextInput boxes, evenly spaced. Each box is ~(screenWidth - 90) / 6 wide, 52px tall, white background, 1.5px border.
   - Default border: `#E2E0DA`
   - Active/filled border: `#C10F1D` (red accent)
   - Focused background: `#FEF9F9` (very light red tint)
   - Auto-advances to next box on digit entry; backspace goes to previous box
5. **Resend row** — "Didn't receive it? [Resend code]" — resend link in red, shows "Sending…" / "Code resent" feedback
6. **"Verify" button** — full-width red, dimmed (opacity 0.5) until all 6 digits filled, shows spinner while verifying
7. **Helper text** — "Code expires in 10 minutes" — 10px muted

**Inputs:** 6 × single-digit number-pad TextInputs

**Buttons:**
- Back → `navigation.goBack()`
- Resend link (text) → re-sends OTP, label toggles for 2 seconds
- Verify → calls `supabase.auth.verifyOtp` → routes to ProfileSetup (new) or MainTabs (returning)

**Animations:** None  
**Header/Nav:** Manual back button only

---

### EmailWaitingScreen

**Background:** `#F7F6F0`  
**Layout:** SafeAreaView, back button top-left, content centered vertically in remaining space.

**Sections (top to bottom):**
1. **Back button** — circular grey, chevron-left, top-left
2. **Centered content block:**
   - Red envelope SVG icon (64×64)
   - "Check your email" — 22px bold
   - "We sent a sign-in link to:" — 13px secondary
   - Email address in bold 14px
   - "Tap the link in the email to continue." — 13px secondary, maxWidth 260
   - "Make sure to check your spam folder" — 11px muted
   - **"Resend email" button** — full-width outlined (border `#E2E0DA`), label toggles to "Email sent!" for 2 seconds
   - **"Use a different email" link** — 13px red, centered

**Buttons:**
- Back → `navigation.goBack()`
- Resend email → re-sends OTP email
- "Use a different email" → `navigation.goBack()`

**Note:** This screen is registered in navigation but never navigated to in the current flow.

---

### ProfileSetupScreen

**Background:** `#F7F6F0`  
**Layout:** SafeAreaView → KeyboardAvoidingView → ScrollView, content centered.

**Sections (top to bottom):**
1. **Back button** — circular grey, chevron-left, aligned left
2. **Avatar circle** — 56×56, grey `#ECEAE4` background, person outline SVG icon in muted color
3. **Title** — "What should we call you?" — 18px bold, centered
4. **Subtitle** — "Just a few details to get started" — 12px secondary, centered
5. **FIRST NAME label** + TextInput (white card, border, border-radius 10, words auto-cap)
6. **LAST NAME label** + TextInput
7. **PREFERRED NAME (optional) label** + TextInput
8. **"Get started →" button** — full-width red, disabled (grey `#E2E0DA`) until first name + last name filled. Shows spinner while saving.
9. **Helper text** — "You can update this anytime in your profile"

**Inputs:**
- First name (words capitalize)
- Last name (words capitalize)
- Preferred name (words capitalize, optional)

**Buttons:**
- Back → `navigation.goBack()`
- "Get started →" → upserts profile, resets nav stack to MainTabs

**Animations:** None  
**Header/Nav:** Manual back button only

---

### DashboardScreen (Home tab)

**Background:** `#F7F6F0`  
**Layout:** Non-scrolling fixed top section + flex activity card that fills remaining space. Pinned "Start New Shipment" button floats above tab bar.

**Sections (top to bottom):**

**Fixed top section (paddingTop 56, paddingHorizontal 20):**
1. **Greeting row** — "Welcome back 👋" (22px bold) left; notification bell icon right (taps → Activity screen)
2. **Subgreeting** — "X active shipment(s)" or "No active shipments" or "Loading…"
3. **Skeleton cards** (2 × grey rounded rectangles) shown on first load only
4. **Primary shipment card** (white, border-radius 16, colored left-border matching status):
   - Row: shipment ref (#XXXXXXXX) + colored status badge pill
   - Route text: "Origin → Destination" (12px secondary)
   - **Animated sweeping divider** — 1px line with a red `#C10F1D` glow segment that sweeps left-to-right on loop (2800ms, restarts)
   - Stage name in 20px bold
   - Slot name · slot tag (12px secondary)
5. **Secondary shipment card** (same structure but smaller, 16px bold stage name)
6. **Empty state card** (when no shipments) — box icon, "Start your first shipment" title, subtitle, red "Start Shipment" button

**Activity card (flex, fills remaining space):**
- "RECENT ACTIVITY" uppercase label (11px semibold, letter-spacing 1.2)
- ScrollView of activity items: message (13px) + relative time (11px). Alert/warning type items get `#FDE8E8` red tint background with bold dark-red text. Thin `#E2E0DA` dividers between items.
- Tapping an item navigates to the related shipment

**Floating button (absolute, above tab bar):**
- "Start New Shipment" — `#9B1C1C` (darker red), border-radius 14, covers full width minus 20px margins

**Buttons:**
- Notification bell → Activity screen
- Shipment cards → ShipmentDetail or ShipmentWorkspace (via `navigateToShipment` helper)
- Activity items → same shipment navigation
- "Start New Shipment" (pinned) → ShippingRoute
- "Start Shipment" (empty state) → ShippingRoute

**Animations:** Animated sweeping divider on primary shipment card (loops continuously while screen is focused)  
**Header/Nav:** Bottom tab bar present

---

### ShipmentsScreen (Shipments tab)

**Background:** `#F7F6F0`  
**Layout:** Fixed header + tab switcher, scrollable card list below.

**Sections (top to bottom):**
1. **Header** — "Shipments" (22px bold), paddingTop = safeArea + 24
2. **Tab switcher** — "Active" / "Completed" centered tabs, 2px underline indicator in red for active tab, border-bottom on container
3. **Card list** (ScrollView, paddingBottom 96):

**Active tab:**
- **IN PROGRESS section** (if any) — uppercase label, then yellow-bordered cards:
  - Shipment ref + "In Progress" amber badge
  - Slot name + rate (12px secondary)
  - "X items added · awaiting payment" (12px muted)
- **Active shipments** — colored-border cards:
  - Shipment ref + colored status badge
  - Route (12px secondary)
  - Phase label (13px medium)
  - Est. delivery or "Updated [date]" (12px secondary)

**Completed tab:**
- White bordered cards:
  - Shipment ref
  - Route
  - "Delivered" label (15px semibold, secondary color)
  - "Delivered on [date]"

**Empty state:** "No active shipments" / "No completed shipments" — centered muted text

**Buttons:**
- Tab buttons → switch tab
- Any shipment card → `navigateToShipment` → ShipmentDetail or ShipmentWorkspace

**Animations:** None  
**Header/Nav:** Bottom tab bar present

---

### ActionsScreen (Actions tab)

**Background:** `#F7F6F0`  
**Layout:** Fixed header, scrollable action cards below. ActionBottomSheet overlaid when action tapped.

**Sections (top to bottom):**
1. **Header** — "Actions" (22px bold) + "Things that need your attention" (13px secondary), paddingTop = safeArea + 24
2. **Action cards** (ScrollView):
   - White, border-radius 16, 1px border `#E2E0DA`
   - Top row: action title (15px bold, flex 1) + due badge pill (color-coded):
     - Overdue → `#FEE2E2` bg, `#991B1B` text — "Due today"
     - Due ≤3 days → `#FEF3C7` bg, `#B45309` text — "Due tomorrow" / "Due in X days"
     - Future → `#F0EEE8` bg, `#6B6B6B` text
   - Shipment context line (12px secondary): "Shipment #XXXXXXXX · Origin → Destination"
   - Bottom row (right-aligned): small red action button ("Respond" / "Upload" / "Confirm" / "Add Address")

**Empty state:** Green circle with checkmark icon, "All caught up" title, "No actions needed right now" subtitle

**Buttons:**
- Action card (anywhere) → opens ActionBottomSheet
- Small red action button → same
- (ActionBottomSheet renders inline — see Components section)

**Animations:** None  
**Header/Nav:** Bottom tab bar present. ActionBottomSheet overlaid from bottom.

---

### ToolsScreen (Tools tab)

**Background:** `#F7F6F0`  
**Layout:** Fixed header + single centered card.

**Sections:**
1. **Header** — "Tools" (22px bold)
2. **Coming Soon card** — white, border-radius 16, centered:
   - Wrench (construct-outline) icon, 32px, grey `#D4D2CC`
   - "Coming Soon" (16px bold)
   - "Useful tools for shippers will appear here" (13px secondary)

**Buttons:** None  
**Header/Nav:** Bottom tab bar present

---

### ActivityScreen

**Background:** `#F7F6F0`  
**Layout:** Fixed header, full-screen ScrollView of activity items.

**Sections (top to bottom):**
1. **Header row** — back button (circular grey, chevron-left) + "Activity" (22px bold)
2. **Activity list** (ScrollView):
   - Each item: message text (13px) + relative time (11px secondary)
   - Alert/warning type: `#FDE8E8` red background, bold dark-red `#9B1C1C` message text, red accent timestamp
   - Normal: white background
   - 1px `#E2E0DA` dividers between items
3. **Empty state** — "No activity yet" centered muted text

**Buttons:**
- Back → `navigation.goBack()`
- Any activity item → marks as read + navigates to related shipment

**Animations:** None  
**Header/Nav:** Manual back only (stack screen above tabs)

---

### ShippingRouteScreen

**Background:** `#F7F6F0`  
**Layout:** SafeAreaView, content paddingTop = safeArea + 24. Cancel button absolutely pinned to bottom.

**Sections (top to bottom):**
1. **Header** — "Where are you shipping?" (20px bold) + "Select your origin and destination" (13px secondary)
2. **ORIGIN picker row** — uppercase label + white bordered tappable row (selected country flag + name, or placeholder). Chevron-down icon right.
3. **DESTINATION picker row** — same structure
4. **"Continue" button** — full-width red, disabled (grey) until both origin and destination selected. Navigates to SlotSelection.
5. **"Cancel" link** — absolutely positioned at bottom, red text, centered. Goes back.

**Country Picker Modal** (bottom sheet, transparent overlay):
- Semi-transparent dark overlay (`rgba(0,0,0,0.35)`) tappable to dismiss
- White bottom sheet, border-radius 20 top corners, handle bar
- FlatList of country options: flag + country name + red checkmark for selected
- Slides up from bottom (animationType="slide")

**Buttons:**
- Origin row → opens origin modal
- Destination row → opens destination modal
- Continue → SlotSelection
- Cancel → `navigation.goBack()`

**Animations:** Modal slide-up  
**Header/Nav:** Manual only (no back button visible — cancel text link at bottom)

---

### SlotSelectionScreen

**Background:** `#F7F6F0`  
**Layout:** SafeAreaView → ScrollView.

**Sections (top to bottom):**
1. **Header row** — "Choose a freight slot" (20px semibold) + subtitle + "Cancel" text link (right-aligned, grey)
2. **Slot cards** (stacked, marginBottom 10 each):
   - Default border: 1px `#E2E0DA`
   - Selected border: 1.5px red `#C10F1D`
   - Top row: slot name + tag pill (color by tag type: green for "recommended", red for "fast/express", grey otherwise)
   - "General goods" rate label + £X/kg value (15px semibold)
   - Estimated duration (12px secondary)
   - "See all rates ↓" / "Hide rates ↑" toggle link (red) — visible if more than 1 rate type
   - **Expanded section** (when toggled): grey top-border, lists all rate rows (general/battery/branded/liquid)
3. **"Create Shipment →" button** — full-width red, at bottom

**Buttons:**
- Cancel → `navigation.goBack()`
- Slot card tap → selects slot (updates border to red)
- "See all rates" toggle → expands/collapses rate table inline
- "Create Shipment →" → navigates to ShipmentWorkspace with selected slot

**Animations:** None (expansion is instantaneous)  
**Header/Nav:** Manual only

---

### ShipmentWorkspaceScreen

**Background:** `#F7F6F0`  
**Layout:** SafeAreaView → fixed header → ScrollView. Floating elements absolute-positioned.

**Sections (top to bottom):**

**Header:**
- Back button (circular grey, chevron-left) — only visible when parcels have been added
- Shipment ref (#XXXXXXXX) + "In progress" amber pill badge
- Subtitle: "Started [date] · £X/kg slot" or "Creating shipment…"

**Scroll content:**
1. **DROP-OFF ADDRESS section label**
   - White card: warehouse address text + "Send your items to this address" note + "Copy address" button (small bordered row with clipboard icon). Button label changes to "Copied!" for 1.5s.
2. **PARCELS (X) section label**
   - Total weight row: "Total weight: X kg" or "Total weight: Pending weighing" + info circle (taps shows Alert)
   - **ParcelCard** (per parcel, white, border-radius 14):
     - Top row: item name(s) (13px semibold, 1 line) + status badge (colored: In Transit=blue, Arrived=green, Held=amber, Returned=red)
     - Tracking/reference ID — red underlined tappable link (opens QR modal)
     - Weight display: "X kg" if set
     - Sensitive type chips (grey `#F0EEE8` pills, 10px)
     - Thin grey divider
     - "Photos" toggle row (chevron up/down) → expands/collapses photo section
     - Expanded photo section: "No photos yet" text (photo upload not implemented)
   - **"+ Add parcel" button** — dashed border `#D4D2CC`, border-radius 14, red text
3. **Ready to ship section:**
   - **"Ready to ship →" button** — full-width red, disabled (grey) when no parcels. → ShipmentCheckout
   - Helper text: "All items arrived? Proceed to delivery and payment"

**Floating elements:**
- **"Cancel shipment" link** — absolute bottom, only shown when no parcels added. Red text, centered. Soft-deletes shipment (`is_visible: false`) and goes back.
- **Floating home button** — absolute right edge, bottom 100px. Semi-transparent red-tinted pill (left-rounded only). Red house SVG icon. → MainTabs.

**AddItemBottomSheet** — rendered inline, slides up from bottom when "+ Add parcel" tapped  
**ParcelQRModal** — slides up from bottom when tracking ID link tapped

**Parcel QR Modal:**
- White bottom sheet, top rounded corners, handle bar
- Close X button (circular `#F0EEE8`) top-right
- Parcel name (18px bold, centered) + reference label (13px secondary)
- QR code (180×180, black on white)
- Reference code text (16px bold, letter-spacing 2)
- "Copy reference" outlined button → copies to clipboard, label toggles to "Copied!" for 1.5s

**Buttons:**
- Back → `navigation.goBack()` (only with parcels)
- "Copy address" → clipboard
- Tracking ID link → opens QR modal
- Photos toggle → expand/collapse
- "+ Add parcel" → opens AddItemBottomSheet
- "Ready to ship →" → ShipmentCheckout
- "Cancel shipment" → soft-delete + go back
- Floating home → MainTabs

**Animations:** `LayoutAnimation.easeInEaseOut` on photo section expand/collapse  
**Header/Nav:** Manual header only (no nav bar — full-screen stack)

---

### ShipmentDetailScreen

**Background:** `#F7F6F0`  
**Layout:** Fixed header area (back + shipment ref + status) + tab bar + tab content area.

**Header:**
- Back button (circular grey) + shipment ref (#XXXXXXXX) + colored status badge pill
- Route line: "Origin → Destination" (12px secondary)
- **Fading divider** — 10-segment opacity-faded horizontal line (approximates gradient fade)

**Tab bar (4 tabs, underline indicator):**
- Timeline / Details / Documents / Events
- Active tab: `#1A1A1A` text, 2px red underline. Inactive: `#6B6B6B`.

**Timeline tab:**
- Vertical stepper list (6 stages: Received → Origin Port → In Transit → Destination Port → Out for Delivery → Delivered)
- Each stage: left column (top line + dot + bottom line) + right card (label + subtitle + timestamp)
  - Completed stage: green `#22C55E` dot and lines, timestamp shown
  - Active stage: red `#C10F1D` dot, no timestamp, label in bold primary color
  - Upcoming stage: grey `#D4D2CC` dot, muted label and subtitle

**Details tab:**
- Collapsible sections (tap header to toggle), separated by dividers:
  1. **Shipment Info** — key-value rows: Slot, Origin, Destination, Delivery Address, Carrier, Tracking ref, Est. delivery, Created
  2. **Cargo Info** — table: Item | Reference, one row per parcel, category shown below item name
  3. **Cost** (lock icon in header) — Rate, Weight, Total rows
- Each section header: title (15px semibold) + optional lock icon + chevron (up when open)

**Documents tab:**
- List of documents: file name + upload source (user/admin) + timestamp + download icon button
- "Upload document" red button at bottom → action sheet to pick Photo or PDF → uploads to Supabase Storage
- Spinner shown per-document while downloading

**Events tab:**
- Combined feed of activity messages + pending actions, sorted by date
- Activity items: message + time-ago
- Action items: title + description + action type chip + "Submit" action button (opens ActionBottomSheet)

**Buttons:**
- Back → `navigation.goBack()`
- Tab buttons → switch tab
- Section header (Details tab) → collapse/expand
- Document download → download + share
- "Upload document" → action sheet → upload
- Action "Submit" button → opens ActionBottomSheet

**Animations:** None explicitly (section toggle is instant)  
**Header/Nav:** Manual back (stack screen)

---

### ShipmentCheckoutScreen

**Background:** `#F7F6F0`  
**Layout:** SafeAreaView → fixed header → ScrollView.

**Header:**
- Back arrow (Ionicons arrow-back) + "Complete your shipment" (centered, 18px bold) + spacer

**Scroll sections (top to bottom):**

1. **DELIVERY ADDRESS section label**
   - Tappable address row (white bordered, border-radius 12): location pin SVG + address text (or "Select delivery address" placeholder) + chevron-right. Opens AddressBottomSheet.

2. **COST BREAKDOWN section label**
   - White pricing card (border-radius 16):
     - "Total weight" / value (from DB: "X kg" or "Pending")
     - "Rate per kg" / value (from DB: "£X/kg" or "TBC")
     - 1px divider
     - "Amount due" (bold) / value (from DB: "£X.XX" or "Pending")

3. **WEIGHT & VOLUME PROOF section label**
   - Card with empty state: camera icon (grey), "No photos yet", "Your operator will upload weight and volume photos here" — placeholder UI only

4. **PAYMENT section label**
   - **Apple Pay + Google Pay row** — two side-by-side white bordered cards (selected gets red border):
     - Apple Pay card: Apple logo (black) + "Apple Pay" label
     - Google Pay card: Google G icon (multicolour) + "Google Pay" label
   - **Pay by card row** — full-width white bordered card: card icon + "Pay by card" + red dot when selected
   - **Saved cards expansion** (shown only when "Pay by card" selected, `#F7F6F0` bg, border-radius 12):
     - List of saved cards: BRAND •••• last4 + exp date, radio button right (red fill when selected)
     - "+ Add new card" red link → navigates to SavedCards screen
   - **Bank transfer row** — full-width white bordered card: bank icon + "Bank transfer" + red dot when selected
   - **Bank details expansion** (shown only when bank selected):
     - Key-value rows: Bank, Account number, Sort code, Reference (MOCK data)
     - Divider
     - **Upload payment proof** area: dashed button → action sheet (Photo or PDF) → upload to Supabase Storage. Shows filename + "Remove" link after upload.

5. **"Confirm & pay" button** — full-width red, shows spinner while processing. Disabled if no address. For bank transfer: updates shipment and goes to ShipmentActive. For card/Apple/Google Pay: calls `create-payment-intent` Edge Function → Stripe payment sheet.

**Buttons:**
- Back → `navigation.goBack()`
- Address row → opens AddressBottomSheet
- Payment method cards → select method
- Saved card rows → select card
- "+ Add new card" → SavedCards screen
- Upload payment proof → action sheet → upload
- "Confirm & pay" → payment flow → ShipmentActive

**Animations:** None  
**Header/Nav:** Manual header (stack screen)

---

### ShipmentActiveScreen

**Background:** `#F7F6F0`  
**Layout:** SafeAreaView, all content centered vertically.

**Sections (centered, top to bottom):**
1. **Progress ring + checkmark** — SVG-based animated ring:
   - Outer ring: 102×102 SVG. Grey track circle + animated green `#15803D` arc that fills over 4 seconds
   - Inner circle: 80×80, `#DCFCE7` (light green) background, green checkmark SVG (36×36)
2. **"Shipment activated"** — 22px bold
3. **Subtitle** — "Your shipment is now active and will begin moving shortly." — 13px secondary, centered, maxWidth 260
4. **"Track Shipment" button** — full-width red → ShipmentDetail (currently hardcoded shipment ID `C0401` — MOCK)
5. **"Back to Home" button** — full-width outlined (1px border `#E2E0DA`), grey secondary text
6. **"Returning to home automatically..."** — 11px muted

**Behavior:** The animated ring plays for 4 seconds. When it completes, the app automatically resets navigation stack to MainTabs.

**Buttons:**
- "Track Shipment" → ShipmentDetail (hardcoded mock ID)
- "Back to Home" → MainTabs (nav stack reset)

**Animations:** `Animated.timing` on SVG `strokeDashoffset`, 4000ms linear, non-native driver (SVG prop)  
**Header/Nav:** None (full-screen, auto-redirects)

---

### SavedCardsScreen

**Background:** `#F7F6F0`  
**Layout:** SafeAreaView → fixed header → ScrollView.

**Header:**
- Back chevron (circular grey) + "Payment methods" (centered 18px bold) + spacer

**Scroll sections:**
1. **SAVED CARDS section label** (only shown when cards exist)
   - White card, border-radius 16, each saved card as a row:
     - Card brand uppercase + "•••• last4" (14px bold) + "Expires M/YYYY" (12px secondary)
     - Right side: "Default" pill (`#F0EEE8` bg, grey text) OR "Set default" text link (grey)
     - Trash icon (red `#EF4444`) → Alert confirm → deletes card
     - Thin `#E2E0DA` dividers between rows

2. **ADD NEW CARD section label**
   - **CardField** (Stripe) — white background, 1px `#E2E0DA` border, border-radius 12, 50px tall
     - Placeholder: "4242 4242 4242 4242"
     - Input goes dark `#1A1A1A` text, `#A0A0A0` placeholder
   - **"Save card" button** — full-width, red when card complete, grey `#D4D2CC` when not. Shows spinner while saving.

**Buttons:**
- Back chevron → `navigation.goBack()`
- "Set default" → updates `saved_cards` table (all false, then target true)
- Trash icon → Alert confirm → delete from `saved_cards`
- "Save card" → `createPaymentMethod({paymentMethodType: 'Card'})` → insert to `saved_cards`

**Animations:** None  
**Header/Nav:** Manual header (stack screen)

---

### ProfileScreen (Profile tab)

**Background:** `#F7F6F0`  
**Layout:** KeyboardAvoidingView → fixed avatar section → ScrollView of cards.

**Avatar section (fixed, paddingTop = safeArea + 32):**
- Circle (80×80, `#ECEAE4` grey) with user initials (22px bold, grey)
- Display name below (18px bold)

**Scroll sections:**

1. **Personal Information** (section label row — pencil/edit icon, not tappable)
   - White card, rows separated by 1px dividers:
     - First Name / value
     - Last Name / value
     - Email / value + "Verified" green pill (if set)
     - Phone / value or "Tap to add" — **tappable row**: enters inline edit mode:
       - TextInput (phone-pad) + "Save" (red text) + "Cancel" (grey text) buttons inline
       - If phone set but not verified: "Verify" red-outlined pill button

2. **Saved Addresses** (section label row — pencil icon, entire row tappable → opens AddressBottomSheet)
   - White card: list of saved address lines, each with "Default" pill if applicable. Empty state: "No saved addresses yet"

3. **Identity Verification** (standalone section label, not tappable)
   - White card:
     - Status row: "Status" label + "Not verified" amber pill
     - Divider
     - "Verify my identity" → Coming Soon (tappable but no navigation)

4. **Payment Methods** (section label row — pencil icon, entire row tappable → SavedCards)
   - White card: "X card(s) saved" or "No cards saved" (13px secondary)

5. **Actions card** (marginTop 24):
   - "Sign out" (red text) → signs out Google + Supabase, resets to Welcome
   - Divider
   - "Help improve the app" row → no action currently

**Inputs:**
- Phone (inline, phone-pad keyboard) — edit mode only

**Buttons:**
- Saved Addresses section header → opens AddressBottomSheet
- Phone row → enters inline edit mode
- "Save" (phone) → saves to DB
- "Cancel" (phone) → reverts
- "Verify" pill → "Coming Soon" alert
- "Verify my identity" → no action
- Payment Methods section header → SavedCards
- Sign out → Welcome screen

**Animations:** None  
**Header/Nav:** Bottom tab bar present. AddressBottomSheet overlaid.

---

## Components

---

### AddItemBottomSheet

**Type:** Transparent-overlay Modal, slides up from bottom  
**Background:** White (`#FFFFFF`), border-radius 20 top corners, maxHeight 90%  
**Triggered from:** ShipmentWorkspaceScreen "+" Add parcel button

**Contents (top to bottom inside scroll):**
1. **Handle bar** — 36×4px grey pill, centered
2. **"Add parcel" title** — 17px bold
3. **WHAT'S INSIDE? section** — item name inputs (one per row):
   - Each row: text input (f`#F7F6F0` bg, 1px border) + "×" remove button (if more than 1 row)
   - "+ Add another item" red link below adds a new row
4. **TRACKING ID (optional) section** — single TextInput, placeholder "Leave blank to auto-generate a reference", auto-caps characters
5. **SPECIAL REQUIREMENTS section:**
   - "General Goods" selectable row (white card with red border when selected, radio button right)
   - "Sensitive Goods" label + chip row: "F-Brand", "Magnetic", "Battery", "Cell Phone", "Perfume" — each a toggle chip. Active chips: `#FEF0F0` bg, red border `#C10F1D`. Inactive: white, grey border.
   - Selecting any chip auto-switches category to 'sensitive'
6. **£ Value (optional) TextInput** — numeric keyboard
7. **SHOPPING RECEIPT (OPTIONAL) section:**
   - "Upload receipt (optional)" dashed button (paperclip icon) → Alert with Photo/PDF options → uploads to Supabase Storage
   - After upload: green success row with filename + "Remove" link
8. **"Add parcel" red button** — disabled until at least one item name filled

**Behavior when opened:** Slides up from bottom. Tapping the transparent overlay area above dismisses it.  
**Behavior when closed:** Resets all form fields. Calls `onAdd()` with item data before closing (on submit).  
**Keyboard:** KeyboardAvoidingView (`padding` on iOS, `height` on Android). Scroll with `keyboardShouldPersistTaps="handled"`.

---

### ActionBottomSheet

**Type:** Transparent-overlay Modal, slides up from bottom  
**Background:** White (`#FFFFFF`), border-radius 20 top corners, maxHeight 92%  
**Triggered from:** ActionsScreen card tap, ShipmentDetailScreen Events tab

**Contents (top to bottom):**
1. **Handle bar** — 36×4px grey pill, centered
2. **"Done" button** — appears top-right only when keyboard is visible (red text, dismisses keyboard)
3. **Top row:** action title (18px bold, flex 1) + "×" close button (circular `#F0EEE8`)
4. **Description text** — 13px secondary, explains what is needed
5. **Dynamic input area** — switches based on `actionType`:
   - **`address`:** multiline TextInput (min-height 80, `#F7F6F0` bg)
   - **`confirm`:** explanatory text + checkbox row ("I confirm the details are correct") — checkbox fills red when checked
   - **`document`:** "Upload Document" bordered button → Alert with Photo/PDF → uploads file. Shows green success row with filename + "Remove" after upload. Spinner while uploading.
   - **`default`:** single-line TextInput
6. **Divider line**
7. **Shipment context line** — e.g. "Shipment #XXXXXXXX · Origin → Destination" (12px secondary)
8. **"View Shipment →" link** (red) — closes sheet and navigates to ShipmentDetail
9. **"Submit" button** — full-width red

**Behavior when opened:** Slides up from bottom. Dark semi-transparent backdrop (`rgba(0,0,0,0.4)`). Tapping backdrop dismisses keyboard but NOT the sheet.  
**Behavior on submit:** Updates action status to 'submitted' in DB. For address type, also updates shipment delivery_address. Calls `onSubmit()` callback then closes.  
**Keyboard:** KeyboardAvoidingView (`padding` on iOS). "Done" button appears top-right when keyboard shows to dismiss it.

---

### AddressBottomSheet

**Type:** Transparent-overlay Modal, slides up from bottom  
**Background:** White (`#FFFFFF`), border-radius 20 top corners, maxHeight 92%  
**Triggered from:** ShipmentCheckoutScreen delivery address row, ProfileScreen Saved Addresses section

**Contents (top to bottom):**
1. **Handle bar** — 36×4px grey pill, centered
2. **"Done" button** — top-right, only when keyboard visible (red text)
3. **"Delivery address" title** — 17px bold
4. **SAVED ADDRESSES label** (only if addresses exist)
5. **Address rows** (one per saved address):
   - Address line 1 (13px primary) + city/country (12px secondary)
   - Action links row (below address text, only when `userId` provided): "Set as default" (grey) + "Remove" (red) — disabled while mutation in progress
   - Radio button right side (18×18, red fill when selected)
   - 1px dividers between rows
6. **Divider**
7. **"+ Add new address" link** (red) — toggles new address input
8. **New address TextInput** (when expanded): multiline, `#F7F6F0` bg, min-height 80, full-street-address content type, scrolls sheet to bottom on focus
9. **"Save for future use" toggle row** — label + Switch (thumb color: red when on, white when off; track: `#F7CBCD` when on)
10. **"Confirm address" button** — full-width red

**Behavior when opened:** Syncs local state from `savedAddresses` prop. Selects default address or first address by default. Resets new-address input.  
**Behavior on confirm:** If new-address input has text, uses that (and calls `onSaveNewAddress` if "save for future" is on). Otherwise uses selected saved address. Calls `onConfirm(address)` then closes.  
**Set default:** Updates `saved_addresses` table (all false, then target true). Updates local state immediately.  
**Remove:** Deletes from `saved_addresses` table. Updates local state immediately. If removed address was selected, selects next available.  
**Keyboard:** KeyboardAvoidingView. "Done" button visible when keyboard open. New address input scrolls sheet to end on focus.
