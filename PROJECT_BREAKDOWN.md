# Circuit 41 — Project Breakdown

---

## 1. TECH STACK

### Runtime Dependencies

| Package | Version | What it does |
|---|---|---|
| `expo` | ^55.0.9 | The Expo framework — provides the build toolchain, dev server, and native module bridge |
| `react` | 19.2.0 | Core React library — components, state, hooks |
| `react-native` | ^0.83.4 | Core React Native framework — maps React to native iOS/Android UI primitives |
| `react-native-web` | ^0.21.0 | Allows the React Native app to also run in a web browser |
| `react-dom` | 19.2.0 | React's web renderer — required by react-native-web |
| `@react-navigation/native` | ^7.2.1 | Core navigation library — provides `NavigationContainer` and shared navigation types |
| `@react-navigation/native-stack` | ^7.14.9 | Stack navigator — used for auth flow and detail screens with slide/push transitions |
| `@react-navigation/bottom-tabs` | ^7.15.9 | Bottom tab navigator — powers the main five-tab app shell |
| `react-native-screens` | ~4.23.0 | Native screen primitives that make navigation faster and more memory-efficient |
| `react-native-safe-area-context` | ~5.6.2 | Provides `SafeAreaView` and `useSafeAreaInsets` to handle notches, home indicators, and status bars |
| `react-native-svg` | 15.15.3 | SVG rendering — used for all custom icons throughout the app (Path, Rect, Circle, etc.) |
| `react-native-qrcode-svg` | ^6.3.21 | Renders QR codes — used in the ShipmentWorkspace parcel detail modal |
| `expo-clipboard` | ~55.0.9 | Clipboard access — used to copy the warehouse drop-off address in ShipmentWorkspace |
| `expo-font` | ~55.0.4 | Font loading infrastructure — used internally by `@expo-google-fonts` packages |
| `expo-status-bar` | 55.0.5-canary | Controls the device status bar style (set to "light" in App.tsx) |
| `@expo-google-fonts/plus-jakarta-sans` | ^0.4.2 | Plus Jakarta Sans font family — the app's only typeface (400, 500, 600, 700 weights) |
| `@expo-google-fonts/inter` | ^0.4.2 | Inter font — **installed but not used anywhere in the current codebase** |

### Dev Dependencies

| Package | Version | What it does |
|---|---|---|
| `typescript` | ~5.9.2 | TypeScript compiler — all screens and components are typed `.tsx` files |
| `@types/react` | ~19.2.2 | TypeScript type definitions for React |

---

## 2. NAVIGATION STRUCTURE

### Architecture

The app uses two nested navigators:

```
Stack Navigator (RootStack)
├── Welcome               ← app entry point
├── PhoneEmail
├── Verification
├── ProfileSetup
├── MainTabs              ← wraps the Tab Navigator
│   ├── Tools             (tab 1)
│   ├── Shipments         (tab 2)
│   ├── Home              (tab 3 — center)
│   ├── Actions           (tab 4)
│   └── Profile           (tab 5)
├── ShipmentDetail        ← pushed from Home, Shipments, Activity, ActionBottomSheet
├── Activity              ← pushed from Home bell icon
├── ShippingRoute         ← pushed from Home CTA and Shipments empty state
├── SlotSelection         ← pushed from ShippingRoute
├── ShipmentWorkspace     ← pushed from SlotSelection and Shipments in-progress card
├── ShipmentCheckout      ← pushed from ShipmentWorkspace
├── ShipmentActive        ← pushed from ShipmentCheckout
└── NewShipment           ← registered but placeholder, never reached in practice
```

### Key navigation flows

**New user auth:** Welcome → PhoneEmail → Verification → ProfileSetup → MainTabs (Home, isNewUser: true)

**Returning user auth:** Welcome → PhoneEmail → Verification → MainTabs (Home, isNewUser: false)

**Social sign-in (mock):** Welcome Apple/Google buttons → MainTabs directly (no verification step)

**Create shipment:** Home (Start New Shipment) → ShippingRoute → SlotSelection → ShipmentWorkspace → ShipmentCheckout → ShipmentActive → back to MainTabs

**Sign out:** Profile → resets stack to Welcome

---

## 3. SCREEN BY SCREEN BREAKDOWN

---

### WelcomeScreen
**Purpose:** App landing page — presents the brand and sign-in options.

**Key UI:** Circuit logo top-left, "Move goods. Stay in control." headline, "Continue with phone or email" primary button, Apple and Google social buttons, terms and privacy links.

**Navigation:**
- Comes from: App launch (initial route)
- Goes to: PhoneEmail (primary CTA), MainTabs (Apple/Google mock buttons)

**Mock data:** Apple and Google sign-in buttons both navigate directly to MainTabs without any real OAuth — hardcoded `isNewUser: false`.

**Known issues:** Apple and Google OAuth are not implemented. Both buttons are mocks that skip verification entirely.

---

### PhoneEmailScreen
**Purpose:** Collects the user's phone number or email address to send an OTP.

**Key UI:** Phone/Email toggle, phone input with country code selector, country picker modal (full-screen), "Send code" button.

**Navigation:**
- Comes from: WelcomeScreen
- Goes to: VerificationScreen (passes the contact string as a route param)

**Mock data:** 12 hardcoded country codes (UK, Nigeria, US, China, Turkey, Canada, UAE, Ghana, Kenya, South Africa, India, Pakistan). Default country is UK (+44). The "Send code" button does not call any API — it navigates immediately.

**Known issues:** No actual SMS or email sending. Any input (or empty input) triggers navigation to verification.

---

### VerificationScreen
**Purpose:** OTP entry screen — user types a 6-digit code to verify their identity.

**Key UI:** 6 individual digit input boxes with auto-advance and backspace-step-back behaviour, "Resend code" link, "Verify" button.

**Navigation:**
- Comes from: PhoneEmailScreen (receives `contact` param for display)
- Goes to: ProfileSetup (new users) or MainTabs (returning users)

**Mock data:** `isNewUser` is hardcoded `true` — so this always routes to ProfileSetup, never directly to MainTabs for returning users. The resend handler just toggles label text for 2 seconds, no network call.

**Known issues:** Any 6-digit code passes verification. `isNewUser` is a hardcoded constant — returning user path is unreachable in the current build.

---

### ProfileSetupScreen
**Purpose:** Collects the user's name on first sign-up before landing on the dashboard.

**Key UI:** Avatar placeholder circle, first name / last name / preferred name inputs, "Get started →" button (disabled until first and last name are filled).

**Navigation:**
- Comes from: VerificationScreen (new user path)
- Goes to: MainTabs (resets stack, passes `isNewUser: true`)
- Back button: returns to VerificationScreen

**Mock data:** No data is saved anywhere. Name fields are local state that is discarded on navigation.

**Known issues:** Profile data entered here is not persisted. The Dashboard never actually reads the name entered here — it shows a hardcoded "Makk" in ProfileScreen.

---

### DashboardScreen (Home tab)
**Purpose:** Main dashboard — shows active shipment cards, a scrollable activity feed, and the "Start New Shipment" button.

**Key UI:** "Welcome back 👋" greeting + bell icon, primary shipment card (A1023, animated red sweeping divider), secondary shipment card (B0887), recent activity card (fills remaining space, scrolls independently), pinned "Start New Shipment" button above tab bar. Empty state shown when `isNewUser: true`.

**Navigation:**
- Comes from: MainTabs (Home tab), or reset to from ProfileSetup/Verification/ShipmentActive/ShipmentWorkspace
- Goes to: Activity (bell icon), ShipmentDetail (shipment cards), ShippingRoute (Start New Shipment button / empty state button)

**Mock data:** Everything is hardcoded — shipment IDs, routes, statuses, ETA dates, activity items. The `isNewUser` flag comes from route params.

**Known issues:** The animated divider (AnimatedDivider component, defined inline) fires and restarts with a layout measurement loop on every render. All content is mock. The bell icon navigates to ActivityScreen but there is no real notification system.

---

### ShipmentsScreen (Shipments tab)
**Purpose:** Lists all the user's shipments — active and completed — with an Active/Completed tab switcher.

**Key UI:** "IN PROGRESS" section (shipment C0401, amber card), 4 active shipment cards with colour-coded status badges, Completed tab with 10 past shipments.

**Navigation:**
- Comes from: MainTabs (Shipments tab)
- Goes to: ShipmentDetail (any active or completed card), ShipmentWorkspace (in-progress card)

**Mock data:** `hasInProgress` is hardcoded `true`. All shipment data (IDs, routes, statuses, ETAs, delivery dates) is hardcoded in constants at the top of the file.

**Known issues:** Completed cards navigate to ShipmentDetail with `isCompleted: true`, but all completed cards use their own ID — however ShipmentDetailScreen shows the same hardcoded shipment #A1023 data regardless of which ID is passed. No real data fetching.

---

### ActionsScreen (Actions tab)
**Purpose:** Shows a list of pending actions the user needs to take on their shipments.

**Key UI:** "Actions" header with subtitle, scrollable list of action cards (each with title, context, due badge, and action button), empty state with green checkmark when no actions exist.

**Navigation:**
- Comes from: MainTabs (Actions tab)
- Goes to: ActionBottomSheet (modal, opens on card tap), ShipmentDetail (from within ActionBottomSheet)

**Mock data:** 3 hardcoded action cards (provide delivery address, confirm details, upload customs document). `hasActions` is derived from `ACTION_CARDS.length > 0` so the empty state is never visible in the current build.

**Known issues:** Submitting an action in the bottom sheet just closes it — no data is sent anywhere. The shipment context line inside ActionBottomSheet is hardcoded to "#A1023 · Guangzhou → Lagos · In Transit" regardless of which action was tapped.

---

### ToolsScreen (Tools tab)
**Purpose:** Placeholder for future shipper utilities.

**Key UI:** "Tools" header, a single "Coming Soon" card with a wrench icon and explanatory text.

**Navigation:**
- Comes from: MainTabs (Tools tab)
- Goes to: nowhere

**Mock data:** None.

**Known issues:** Entirely unbuilt. No tools exist.

---

### ProfileScreen (Profile tab)
**Purpose:** Shows the user's account information and settings.

**Key UI:** Avatar circle with initials, name display, scrollable cards for Personal Information, Saved Addresses, Identity Verification, Payment Methods, Sign Out / Help.

**Navigation:**
- Comes from: MainTabs (Profile tab)
- Goes to: Welcome (sign out resets the parent stack navigator)

**Mock data:** All values are hardcoded — name "Makk", email "makk@example.com", email shown as "Verified", phone shown as "Not set / Unverified", one empty saved addresses section, identity verification shown as "Not verified".

**Known issues:** None of the tappable rows (Add address, Verify identity, Add card, Help improve the app) do anything — no navigation, no modals. All profile data is hardcoded, not read from any auth or user store.

---

### ShipmentDetailScreen
**Purpose:** Full detail view for a single shipment — timeline, cargo info, documents, events.

**Key UI:** Shipment header with route and status badge, tab bar (Timeline / Details / Documents / Events), 5-stage timeline with dot indicators, 4 collapsible detail sections (Shipment Info, Cargo Info, Parties, Cost), documents list, events feed, bottom action button row. When `isCompleted: true`: delivery banner, all-green timeline, no action buttons shown.

**Navigation:**
- Comes from: DashboardScreen, ShipmentsScreen, ActivityScreen, ActionBottomSheet
- Goes to: ActionBottomSheet (action buttons at bottom), back to previous screen

**Mock data:** All shipment data is hardcoded — #A1023, Guangzhou → Lagos, all timeline timestamps, cargo table (Watches/Sneakers/Blenders), pricing (£1,840 total), parties (Makk Trading Ltd, Guangzhou Beauty Co.), 2 documents, 6 events. The `shipmentId` param is received but not used to fetch anything — the same data always renders.

**Known issues:** The Cost section is marked `locked: true` (has a lock icon UI) but there is no lock/unlock logic implemented. The "Upload document" button in the Documents tab does nothing. All action buttons at the bottom are non-functional except they open ActionBottomSheet (with hardcoded context).

---

### ActivityScreen
**Purpose:** Full-page activity feed showing all recent events across all shipments.

**Key UI:** "Activity" header with back button, scrollable list of 8 activity items (1 alert in red, 7 normal), each row tappable.

**Navigation:**
- Comes from: DashboardScreen (bell icon)
- Goes to: ShipmentDetail (any item tap — hardcoded to shipment #A1023 regardless of which item)

**Mock data:** 8 hardcoded activity items with messages and relative timestamps.

**Known issues:** All 8 items link to the same shipment (#A1023). The comment in the code acknowledges this: "all activity items link to the same shipment until real data is wired."

---

### ShippingRouteScreen
**Purpose:** First step of the shipment creation flow — user picks origin and destination country.

**Key UI:** "Where are you shipping?" heading, two country picker rows (Origin, Destination), bottom sheet modal for each picker, "Continue" button (disabled until both are selected).

**Navigation:**
- Comes from: DashboardScreen (Start New Shipment button), Shipments empty state
- Goes to: SlotSelectionScreen (passes origin and destination as string params)

**Mock data:** Origins hardcoded to China and Turkey only. Destinations hardcoded to UK, Nigeria, US, and Canada only.

**Known issues:** The available routes are entirely hardcoded. No validation that a route is actually serviced. Back button not present — uses iOS swipe-back gesture only.

---

### SlotSelectionScreen
**Purpose:** Second step of shipment creation — user picks a freight slot (Standard, Express, or Economy).

**Key UI:** "Choose a freight slot" heading with Cancel button, 3 slot cards (Standard default-selected), each card shows name, tag pill, base rate, expand toggle for full rate breakdown by item type, "Create Shipment →" CTA.

**Navigation:**
- Comes from: ShippingRouteScreen (receives `origin` and `destination` params)
- Goes to: ShipmentWorkspaceScreen (passes selected slot name, tag, and base rate)

**Mock data:** All 3 slots and their rate tables are hardcoded. The origin/destination params received from ShippingRouteScreen are consumed with `void route.params` — they are not displayed or used for filtering.

**Known issues:** The origin and destination passed in are intentionally discarded (noted in a comment). Real slots should be fetched from a backend based on the route.

---

### ShipmentWorkspaceScreen
**Purpose:** Third step of shipment creation — user builds their parcel list and gets the drop-off address.

**Key UI:** Slot info header (name, tag, rate), drop-off address section with copy button, list of parcels with status badges and QR code tap, "Add parcel" button, back button with smart navigation (to Shipments if items exist, else goBack), "Proceed to Checkout" CTA.

**Navigation:**
- Comes from: SlotSelectionScreen (receives `slot` params), ShipmentsScreen in-progress card (hardcoded slot mock)
- Goes to: ShipmentCheckoutScreen (Proceed to Checkout), AddItemBottomSheet (modal), QR modal (inline Modal), Shipments tab (smart back with items)

**Mock data:** Warehouse address is a hardcoded Guangzhou address. Two pre-populated example parcels (iPhone 15 cases with tracking ID, Wireless earbuds with tracking ID). QR code encodes the tracking ID of whichever parcel was tapped.

**Known issues:** Parcels added via AddItemBottomSheet are appended to state but not persisted. The parcel list resets if the screen is unmounted. Receipt upload shows an Alert saying "Coming soon".

---

### ShipmentCheckoutScreen
**Purpose:** Fourth and final step of shipment creation — reviews costs, sets delivery address, and selects payment method.

**Key UI:** "Complete your shipment" header, delivery address trigger row (opens AddressBottomSheet), estimated cost card with amber pricing notice and line items, weight & volume proof photo section (empty state), payment method selection (Apple Pay default, Google Pay, card, bank transfer), bank transfer detail block (conditional), "Confirm and pay" CTA.

**Navigation:**
- Comes from: ShipmentWorkspaceScreen
- Goes to: ShipmentActiveScreen (Confirm and pay button), AddressBottomSheet (modal)

**Mock data:** Pricing rows hardcoded (£800 general, £260 battery, £1,060 total). Bank transfer details hardcoded (Barclays, account 12345678, sort 20-00-00, ref C0401-PAY). Photo evidence section is always in empty state — no upload capability.

**Known issues:** No real payment processing. "Confirm and pay" navigates to ShipmentActive regardless of whether an address was selected or payment details entered. The weight & volume photo section has no upload functionality — it's purely a placeholder for operator-uploaded content.

---

### ShipmentActiveScreen
**Purpose:** Confirmation screen shown after a shipment is successfully submitted.

**Key UI:** Green circle with checkmark icon, "Shipment activated" headline, subtitle, "Track Shipment" primary button, "Back to Home" outline button.

**Navigation:**
- Comes from: ShipmentCheckoutScreen
- Goes to: ShipmentDetail (Track Shipment — hardcoded to C0401), MainTabs (Back to Home)

**Mock data:** "Track Shipment" hardcodes shipment ID C0401.

**Known issues:** The shipment ID should be dynamic — passed through from the workspace or checkout, not hardcoded.

---

### NewShipmentScreen
**Purpose:** Originally planned as a new shipment entry point.

**Key UI:** Just a "New Shipment — coming soon" text on a dark background.

**Navigation:** Registered in the stack navigator but never navigated to from anywhere in the current codebase.

**Known issues:** This is an orphaned placeholder. The actual new shipment flow now starts at ShippingRouteScreen. This file can be deleted.

---

### HomeScreen *(not registered — orphaned)*
**Purpose:** Early placeholder for the dashboard — now replaced by DashboardScreen.

**Known issues:** Not registered in any navigator. Can be deleted.

---

### SocialAuthScreen *(not registered — orphaned)*
**Purpose:** Early placeholder for Apple/Google OAuth — never built.

**Known issues:** Not registered in any navigator. Can be deleted.

---

## 4. COMPONENT BREAKDOWN

---

### ActionBottomSheet

**Purpose:** A slide-up modal that handles a user action request — can display an address input, a confirmation checkbox, or a document upload button depending on the action type.

**Which screens use it:** ActionsScreen (for each action card), ShipmentDetailScreen (action buttons at the bottom of the screen)

**Props:**
| Prop | Type | Description |
|---|---|---|
| `visible` | `boolean` | Controls whether the modal is shown |
| `onClose` | `() => void` | Called when the sheet is dismissed |
| `actionTitle` | `string` | Displayed as the sheet heading |
| `actionDescription` | `string` | Explanatory text below the heading |
| `actionType` | `'address' \| 'confirm' \| 'document' \| 'default'` | Determines which input UI renders in the sheet body |

**Notes:** The shipment context line inside the sheet is hardcoded to "#A1023 · Guangzhou → Lagos · In Transit" and is not driven by props. The "View Shipment →" link also hardcodes shipment ID A1023. The Submit button just calls `onClose` — no data is sent anywhere.

---

### AddressBottomSheet

**Purpose:** A slide-up modal for selecting or entering a delivery address. Shows saved addresses as radio options, plus an "Add new address" text input and a "Save for future use" toggle.

**Which screens use it:** ShipmentCheckoutScreen (delivery address section)

**Props:**
| Prop | Type | Description |
|---|---|---|
| `visible` | `boolean` | Controls whether the modal is shown |
| `onClose` | `() => void` | Called when the sheet is dismissed |
| `onConfirm` | `(address: string) => void` | Called with the selected/entered address string when the user confirms |

**Notes:** Saved addresses are a hardcoded internal array (one address: 14 Baker Street, London). The "Save for future use" toggle is UI-only — it doesn't persist anything. New addresses entered are only held in local state.

---

### AddItemBottomSheet

**Purpose:** A slide-up modal for adding a new parcel to a shipment workspace. Supports multiple item names, optional tracking ID (auto-generates a REF- reference if left blank), declared value, general/sensitive goods classification with chip selection, and a receipt upload placeholder.

**Which screens use it:** ShipmentWorkspaceScreen (Add parcel button)

**Props:**
| Prop | Type | Description |
|---|---|---|
| `visible` | `boolean` | Controls whether the modal is shown |
| `onClose` | `() => void` | Called when the sheet is dismissed |
| `onAdd` | `(item: NewItem) => void` | Called with the completed item data when the user submits |

**Exported type:**
```typescript
export type NewItem = {
  itemNames:      string[];
  trackingId:     string;
  declaredValue:  string;
  category:       'general' | 'sensitive';
  sensitiveTypes: string[];
  hasReceipt:     boolean;
}
```

**Notes:** `hasReceipt` is always `false` — receipt upload is a stub (shows an Alert). The reference auto-generation (`REF-XXXXX`) is a random 5-character alphanumeric string, not tied to any real system.

---

## 5. CURRENT STATE SUMMARY

### Fully built and working (UI + navigation)

- **Auth flow:** Welcome → PhoneEmail (with country selector) → Verification (6-digit OTP entry with auto-advance) → ProfileSetup → Dashboard. Navigation resets correctly and the stack is cleared on sign-in.
- **Tab navigation:** Dark five-tab bar (Tools, Shipments, Home, Actions, Profile) is correctly architected as a single persistent navigator — no re-render or jump on tab switch.
- **DashboardScreen layout:** Fixed top section, flex activity card, pinned CTA button. Both new user (empty state) and returning user (active shipments) states render correctly.
- **ShipmentsScreen:** Active/Completed tab switcher, in-progress card, 4 active cards with colour-coded status badges, 10 completed cards — all tappable with correct navigation.
- **ShipmentDetailScreen:** Full detail view with 4 tabs (Timeline, Details, Documents, Events), collapsible sections, completed-shipment variant (all-green timeline, delivery banner, hidden action buttons).
- **Shipment creation flow:** ShippingRoute → SlotSelection (with expandable rate cards) → ShipmentWorkspace (parcel list, QR modal, copy address) → ShipmentCheckout (cost summary, payment selector, bank details) → ShipmentActive confirmation.
- **ActionBottomSheet:** Three input variants (address text input, confirmation checkbox, document upload button) all render correctly.
- **AddressBottomSheet:** Saved address radio selection and new address text input work.
- **AddItemBottomSheet:** Multiple item names, optional tracking ID (with auto-REF), sensitive goods chips, declared value all function correctly.
- **ProfileScreen:** All sections render with correct card layout.

### Partially built

- **ActionsScreen:** Cards and bottom sheet UI are complete, but submitting an action does nothing — no data is sent or state updated.
- **ShipmentDetailScreen — Documents tab:** Shows a list of 2 mock documents but has no upload functionality.
- **ShipmentDetailScreen — Cost section:** Has a "locked" flag with a lock icon, but there is no unlock interaction.
- **ProfileScreen — all tappable rows:** "Add address", "Verify identity", "Add card", and "Help improve the app" rows render but do nothing when tapped.
- **ShipmentCheckoutScreen — photo evidence section:** Renders an empty state placeholder — no camera or upload capability.
- **ActivityScreen:** All items display correctly but every row navigates to the same hardcoded shipment regardless of which event was tapped.

### Missing entirely

- **Authentication:** No real OTP sending, no SMS/email integration, no session management, no token storage.
- **Apple/Google OAuth:** Both social sign-in buttons skip verification entirely and navigate directly to the app.
- **Backend / API layer:** Zero network calls exist anywhere in the codebase. There is no API client, no data fetching, no error handling for network failures.
- **User data persistence:** Name entered in ProfileSetup is discarded immediately. ProfileScreen shows hardcoded values.
- **Payment processing:** "Confirm and pay" navigates to the success screen unconditionally — no payment SDK is integrated.
- **File uploads:** Receipt upload (AddItemBottomSheet) and document upload (ShipmentDetailScreen) both show stub UI. Weight & volume photo upload in ShipmentCheckoutScreen is entirely placeholder.
- **Push notifications:** The bell icon navigates to a static feed. No push notification system exists.
- **Address saving:** AddressBottomSheet "Save for future use" toggle is non-functional. No address storage.
- **ToolsScreen:** Entirely unbuilt — shows a "Coming Soon" placeholder.
- **Identity verification flow:** ProfileScreen shows "Not verified" but the "Verify my identity" button does nothing.
- **Saved payment methods:** ProfileScreen "Add card" row does nothing.

### Mock data that needs to be replaced with real backend calls

| Location | Mock data | What replaces it |
|---|---|---|
| DashboardScreen | Shipment cards (A1023, B0887), activity feed items | API: active shipments for authenticated user |
| ShipmentsScreen | All shipment lists (active, completed, in-progress) | API: paginated shipment list |
| ShipmentDetailScreen | All shipment fields, timeline, cargo, documents, events | API: single shipment by ID |
| ActivityScreen | 8 hardcoded activity items | API: activity/events feed |
| ActionsScreen | 3 hardcoded action cards | API: pending actions for user |
| ProfileScreen | Name, email, phone, verification status, saved addresses | Auth user profile API |
| ShippingRouteScreen | Origin (China, Turkey) and destination country lists | API: available routes |
| SlotSelectionScreen | 3 slot types with hardcoded rates | API: available slots and rates for selected route |
| ShipmentWorkspaceScreen | Warehouse address, 2 pre-populated example parcels | API: warehouse address for selected slot/origin |
| ShipmentCheckoutScreen | Pricing rows, total, bank transfer details | API: shipment cost calculation, payment methods |
| ShipmentActiveScreen | Hardcoded shipment ID C0401 in "Track Shipment" button | Dynamic: pass actual created shipment ID through the flow |
| VerificationScreen | `isNewUser = true` hardcoded constant | Auth API response: new vs. returning user flag |
| ActionBottomSheet | Hardcoded "#A1023 · Guangzhou → Lagos" context line | Props: pass shipment context dynamically |
