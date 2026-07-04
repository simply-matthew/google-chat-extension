# Google Chat Read Receipt Blocker

A small Chrome extension with an on/off switch. When it's **on**, Google Chat
is tricked into thinking the page is hidden/unfocused, so it won't send a
"read" signal for messages you're actually viewing.

## How it works

Google Chat has no official setting for this. When you view a conversation,
Chat sends a POST request to mark it read — either through its shared batched
RPC endpoint (URL contains `rpcids=`) or a direct call to an endpoint
containing `api/mark_group_readstate`. This extension patches
`XMLHttpRequest.prototype.open` (and `fetch`, as a backup) on chat.google.com
and Gmail's Chat panel so that, while the toggle is on, POST requests matching
those patterns get silently rerouted to a dead URL instead of reaching
Google's servers. Everything else — loading messages, receiving new ones,
rendering — is untouched.

**Trade-off:** `rpcids=` is a shared endpoint used for a few other Chat
actions too, so some functionality (e.g. certain UI actions) may not behave
normally while this is on. Turn it back off once you're done reading if you
need full functionality back.

**This is unofficial and not guaranteed.** Google can change Chat's internals
at any time and break this.

## Install (load unpacked)

1. Unzip this folder somewhere permanent (don't delete it after installing —
   Chrome loads the extension from this folder).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this folder.
5. Pin the extension (puzzle-piece icon in the toolbar → pin) for easy access.
6. Click the extension icon and flip the switch **On** before opening chats
   you don't want to mark as read.
7. Refresh any open chat.google.com / Gmail tabs after installing, since the
   script needs to load before Chat's own code runs.

## Hotkey Delete

A separate toggle in the popup. When on, pressing **Ctrl+Shift+Backspace**
(**⌘+Shift+Backspace** on Mac) while a chat is open instantly deletes your
most recently sent message in that conversation — **no confirmation dialog
is ever rendered**, since it doesn't go through the UI at all.

How it works:
1. Finds your own messages via `[data-is-viewer-message-creator="true"]` and
   takes the most recent one, reading its `data-message-id`.
2. A script running in Chat's own page context passively watches the auth
   headers Chat's real background requests set (an XSRF token and space ID),
   caching the most recent values without changing any behavior.
3. When you hit the hotkey, it calls Chat's `api/delete_message` endpoint
   directly with those cached headers — the exact call Chat's own "Delete"
   button makes, just fired programmatically instead of through the UI.

A small toast in the bottom-right corner confirms success or reports an
error (e.g. if the auth-header cache is empty because Chat hasn't made a
background request yet — just click around Chat once and try again).

**This only ever targets your own messages** — it can't delete anyone
else's. Since there's no confirmation step of any kind, double check you're
in the right conversation before using it.

## Message History (edited/deleted messages)

A third toggle in the popup. While on, the extension watches messages as
they render and keeps a local copy of the first text seen for each message
ID (stored in `chrome.storage.local` — this device only, never sent
anywhere). If a message's text later changes while its ID stays the same,
that's a reliable signal something happened to it:

- If the new text matches Chat's own placeholder ("This message was
  deleted"), it's flagged as **deleted** (🗑️ badge).
- Otherwise it's flagged as **edited** (✏️ badge).

Click the badge next to the message to see the original text in a small
popup.

**Limitations:**
- It can only log messages that actually rendered in your browser while the
  toggle was on — there's no way to retroactively recover messages sent
  before you enabled it.
- If Chat changes its placeholder wording, the edited/deleted distinction
  may misfire (it'll still catch the change and store the original either
  way, just might mislabel which badge shows).

## Notes

- Turn it back **off** for normal use — it's meant to be flipped on right
  before you peek at a conversation, then off again.
- Works on `chat.google.com` and the Chat panel inside `mail.google.com`.
- No data leaves your browser; the toggle state is stored locally via
  `chrome.storage.sync`.
