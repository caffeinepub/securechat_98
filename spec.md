# SecureChat

## Overview

SecureChat is a private messaging platform built on the Internet Computer. Users authenticate with Internet Identity and can exchange direct messages, create group chats, share files and media, post 24-hour status updates, and manage contacts — all with data stored on-chain in a single Motoko canister. Email-based two-factor authentication is available via Resend OTP. The frontend is a responsive React + TypeScript SPA with a teal/green design language.

## Authentication

- **Internet Identity** is the sole authentication method — no username/password
- All endpoints require authentication via `requireAuth(caller)`, which traps if the caller is anonymous
- User data is fully isolated by principal — users can only access their own profiles, contacts, conversations, and statuses
- Anonymous principals cannot perform any operations
- An admin principal (first to call `initializeAdmin`) can configure email API settings

## Core Features

### Profiles

Users set up a profile on first login:

- **Name** (required, max 100 characters)
- **Bio** (optional, max 500 characters)
- **Avatar** (optional, blob storage reference)
- **Last seen** timestamp (updated automatically when sending messages)
- **Email** (optional, for 2FA verification)
- **Email verified** flag (set via OTP verification)

Public profiles expose: principal, name, bio, avatar, and lastSeen. Email and verification status are private.

### Contact Management

- **Send contact request** to another user by principal — creates a `#Pending` contact on both sides
- **Accept/reject** incoming requests — accept sets both sides to `#Accepted`; reject removes from both sides
- **Remove contact** — removes from both sides
- **Block user** — adds to blocked set, removes from contacts; blocked users cannot send messages or contact requests
- **Unblock user** — removes from blocked set
- **Report user** — stores report with reason, reporter principal, and timestamp
- **Search users** by display name (minimum 2 characters, returns up to 20 results, excludes blocked users)
- **Share ID** — returns the user's principal as text for out-of-band sharing

Contacts have three statuses: `#Pending`, `#Accepted`, `#Blocked`.

### Direct Messaging

- **Start direct chat** — creates a `#Direct` conversation between two users, or returns existing one if already present
- Cannot start chats with yourself or with blocked users
- One direct conversation per user pair (deduplicated)

### Messages

Each message has:

- **Content** (text, required if no media)
- **Message type**: `#Text`, `#Image`, `#File`, `#Audio`, `#Video`
- **Media attachment** (optional): blob reference, file name, file size
- **Reply-to reference** (optional): links to another message ID
- **Reactions**: array of (principal, emoji) pairs — one reaction per user per message
- **Timestamp** (nanoseconds)
- **Deleted flag** — soft delete replaces content with "Message deleted" and clears media

Message retrieval:

- Paginated via `getMessages(conversationId, beforeTimestamp?, limit)` — returns up to 100 messages (default 50), newest last
- Filters out soft-deleted messages and expired disappearing messages
- Frontend polls every 3 seconds when a chat is open

**@mentions**: The backend parses `@username` patterns in message content and creates `#Mention` notifications for matching conversation members.

### Group Chats

- **Create group** with name (required, max 100 characters), member list, and optional avatar
- Creator becomes the group admin
- **Admin-only actions**: update group name/avatar, add members, remove members
- **Any member** can leave; if the admin leaves, the next member becomes admin
- If the last member leaves, the group is deleted
- Group info query returns name, avatar, admin principal, and member profiles

### File & Media Sharing

- Files up to 10 MB can be shared in chat (enforced client-side)
- Supported types: images, videos, audio, documents (PDF, DOC, TXT, ZIP, etc.)
- Files are uploaded via `StorageClient` (blob storage mixin) and attached to messages as `ExternalBlob` references
- In-chat previews for images; file icon + name + size for other types
- Full-screen media preview dialog with download button
- Upload progress bar shown during file sending

### Status Updates

- Post a status with text content and/or media attachment
- Statuses auto-expire after **24 hours** (enforced via `expiresAt` timestamp)
- Only visible to accepted contacts
- Sorted by recency (newest first)
- Users can react to statuses with emoji (one reaction per user per status)
- Users can manually delete their own statuses
- Full-screen status viewer with auto-advance

### Disappearing Messages

- Per-conversation timer: `#Off`, `#Hours24`, `#Days7`, `#Days30`
- Any conversation member can set the timer
- Messages older than the timer duration are filtered out during retrieval (lazy cleanup)
- Timer applies to all messages in the conversation, not per-message

### Notifications

Automatic notifications are generated for:

- **New message** — for all conversation members except sender
- **@mention** — when a user is mentioned in a message
- **Contact request** — when someone sends a contact request
- **Contact accepted** — when a request is accepted
- **Group invite** — when added to a group
- **Status reaction** — when someone reacts to a status

Each notification has: id, kind, timestamp, read flag, optional conversationId, optional fromPrincipal.

- Retrieve up to 100 notifications (default 50), newest first
- Mark notifications as read up to a given ID
- Unread count query for badge display
- Frontend polls unread count every 10 seconds

### Search

- **Search users** by name (min 2 characters, max 20 results)
- **Search messages** across all conversations (min 2 characters, max 30 results) — returns matching messages with conversation context
- **Frontend search overlay** (Ctrl+K / Cmd+K) groups results by: Contacts, Chats, Messages

### Typing Indicators

- Users send typing signals when actively typing in a conversation
- Backend stores last typing timestamp per user per conversation (transient, not persisted)
- Typing users are considered active if their last signal was within 5 seconds
- Frontend sends typing signals throttled to once per 3 seconds
- Frontend polls typing users every 2 seconds

### Email Two-Factor Authentication

- Uses **Resend API** for sending verification emails via HTTP outcalls
- Admin configures: API key (must start with `re_`), sender email, sender name
- Flow: user enters email -> backend generates 6-digit OTP (10-minute expiry) -> sends via Resend -> user enters code -> backend verifies and updates profile
- API key and sender config are transient (reset on canister upgrade)
- One pending OTP per user at a time

## Backend Data Storage

All state uses orthogonal persistence (automatic with `var` declarations):

| State                  | Type                                      | Description                                    |
| ---------------------- | ----------------------------------------- | ---------------------------------------------- |
| `userProfiles`         | `Map<Principal, Profile>`                 | User profiles                                  |
| `userContacts`         | `Map<Principal, Map<Principal, Contact>>` | Per-user contact lists                         |
| `conversations`        | `Map<Nat, Conversation>`                  | All conversations                              |
| `conversationMessages` | `Map<Nat, List<Message>>`                 | Messages per conversation                      |
| `conversationMembers`  | `Map<Nat, Map<Principal, Bool>>`          | Membership per conversation                    |
| `userConversations`    | `Map<Principal, Map<Nat, Bool>>`          | Conversation index per user                    |
| `readCursors`          | `Map<Principal, Map<Nat, Nat>>`           | Last-read message ID per user per conversation |
| `userStatuses`         | `Map<Principal, List<StatusUpdate>>`      | Status updates per user                        |
| `blockedUsers`         | `Map<Principal, Map<Principal, Bool>>`    | Blocked user sets                              |
| `reports`              | `List<Report>`                            | User reports                                   |
| `conversationTimers`   | `Map<Nat, DisappearingTimer>`             | Disappearing message timers                    |
| `userNotifications`    | `Map<Principal, List<Notification>>`      | Notifications per user                         |
| `pendingOtps`          | `Map<Principal, PendingOtp>`              | Pending email verification codes               |
| `adminPrincipal`       | `?Principal`                              | Admin for email config                         |

Transient state (reset on upgrade):

| State              | Description                        |
| ------------------ | ---------------------------------- |
| `emailApiKey`      | Resend API key                     |
| `senderEmail`      | From email address                 |
| `senderName`       | From display name                  |
| `typingIndicators` | Per-conversation typing timestamps |

## Backend Operations

- **Authentication**: Every endpoint calls `requireAuth(caller)` — traps with "Not authenticated" for anonymous callers
- **Authorization**: Conversation operations check membership via `isConversationMember`; group admin operations check `groupInfo.admin == caller`; email admin operations check `adminPrincipal`
- **Input validation**: Name/bio/group name length limits enforced with `Runtime.trap`; empty content checks; email format validation client-side
- **Blocked user checks**: Contact requests, chat creation, and message sending all check blocked status in both directions
- **Error handling**: All errors use `Runtime.trap()` with descriptive messages (no Result types)

## User Interface

### Screens

- **Landing Page** — shown to unauthenticated users with hero section, feature grid, trust section
- **Chats** — conversation list sorted by last message time, with unread badges and message previews
- **Chat View** — full conversation with message bubbles, reply preview, file attachments, typing indicator, emoji reactions
- **Contacts** — pending requests section, accepted contacts list with actions (message, block, report, remove)
- **Status** — "My Status" section with create button, contact statuses grouped by user with ring indicators
- **Settings** — profile card, privacy & security (blocked users, email 2FA), about section, logout

### Dialogs

- `ProfileSetupDialog` — first-time profile creation with name, bio, avatar
- `EditProfileDialog` — update name and bio
- `AddContactDialog` — search users or add by principal ID
- `NewChatDialog` — select contact to start direct chat
- `NewGroupDialog` — create group with name and member selection
- `EditGroupDialog` — update group name (admin only)
- `ManageMembersDialog` — add/remove group members
- `ReportUserDialog` — report with reason selection
- `BlockedUsersDialog` — view and unblock users
- `DisappearingTimerDialog` — set conversation timer
- `CreateStatusDialog` — post text/media status
- `MediaPreviewDialog` — full-screen image/video viewer

### Key Components

- `AppShell` — sidebar navigation (desktop) / bottom tabs (mobile)
- `MessageBubble` — sender-aligned bubbles with timestamp, reactions, reply reference
- `MessageActions` — hover menu with Reply, React, Copy, Delete
- `ImageMessage` / `FileMessage` — media rendering in chat
- `StatusViewer` — full-screen status carousel with auto-advance
- `StatusRing` — circular avatar with colored ring for unviewed statuses
- `SearchOverlay` — global search with keyboard shortcut
- `NotificationsPanel` — dropdown showing recent notifications
- `TypingIndicator` — animated dots with user name(s)
- `EmailVerificationSection` — inline OTP flow in settings

### Navigation

- Desktop: sidebar with tabs for Chats, Contacts, Status, Settings
- Mobile: bottom navigation bar with tab icons and unread badges
- Chat view slides in from right on mobile
- Search accessible via header icon or Ctrl+K / Cmd+K

## Design System

- **Theme**: Teal/green palette — primary `#0d9488`, secondary `#f0fdfa`, accent `#ccfbf1`
- **Typography**: Geist sans-serif (body), Noto Serif Georgian (serif accents)
- **Cards**: `rounded-xl border` containers with `divide-y` separators
- **Avatars**: Circular with colored fallback showing first initial
- **Online indicators**: Green dot overlay on avatar for recently active users
- **Loading states**: `Loader2` spinner, skeleton placeholders for lists
- **Empty states**: Illustrated placeholders with call-to-action
- **Responsive**: Mobile-first with `useIsMobile` hook, breakpoint-based layout switching

## Error Handling

| Category          | Behavior                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Not authenticated | `Runtime.trap("Not authenticated")` — anonymous callers rejected                                     |
| Not a member      | `Runtime.trap("Not a member of this conversation/group")`                                            |
| Blocked user      | `Runtime.trap("Cannot send request/messages to this user")`                                          |
| Not found         | `Runtime.trap("Conversation/Message/Status/File not found")`                                         |
| Permission denied | `Runtime.trap("Only group admin can...")`, `Runtime.trap("Can only delete your own messages")`       |
| Validation        | `Runtime.trap("Name cannot be empty")`, `Runtime.trap("Search query must be at least 2 characters")` |
| Email 2FA         | `Runtime.trap("Email service not configured")`, `Runtime.trap("Invalid/expired verification code")`  |
| Self-action       | `Runtime.trap("Cannot add yourself as a contact")`, `Runtime.trap("Cannot chat with yourself")`      |

Frontend handles errors with:

- `isError` query state rendering error messages with retry
- Mutation `onError` callbacks showing toast notifications or inline error text
- Loading states on all async action buttons
- Disabled buttons during pending mutations
