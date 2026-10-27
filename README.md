# kooba-helper
For a better kooba<=>abook experience.


## Description
* Adds "Copy Title" to Abook forum code boxes and post titles.
* Adds search links to Abook forum code boxes that use `[code]` search strings.
  Search engines: NZBIndex, BinSearch (all groups + Abook-only), NZBKing.
* Adds an **NZBDonkey** highlight block: select it, right-click, "Get NZB File".


## Notice
* This tool is not affiliated with the forum; it was written to be used on it.
* It is an independent tool. If you run into trouble, contact the maintainer and
  **not** the forum staff.


## Maintained / created by
* [Shrek] BTC: 1ANyHwihu9dL2CZ9LUZ48FdYTzyz8CCCFf
* rhymesagainsthumanity
* pushr (original creator of the Chrome extension)


## Install (TamperMonkey / Violentmonkey)
1. Install TamperMonkey (or Violentmonkey) from your browser's add-on/extension
   store — this works in **Chromium, Brave and Firefox**.
2. Open
   `https://raw.githubusercontent.com/exquisiteskink/kooba-helper-updated/master/kooba-helper.user.js`
3. Click **Install**.

TamperMonkey checks `@updateURL` automatically, so future updates are handled
by the extension.


## Bookmarklet
If you do not want a userscript manager, a self-contained bookmarklet is
generated from the same code at:

`https://raw.githubusercontent.com/exquisiteskink/kooba-helper-updated/master/bookmarklet.html`

Drag the "kooba helper" button to your bookmarks bar and click it on each
Abook page you want it to act on (it does not run automatically).


## Browser compatibility notes
The upstream script used brittle DOM traversal that breaks in modern
Chromium/Brave/Firefox. This fork fixes that:

* **Code extraction** walks past whitespace text nodes and handles both the
  `<br>`-after-header (PostBot) layout and the direct-text-node layout, so the
  "code" is never a stray newline.
* **Missing elements** (`#author`, `nextSibling`, missing match groups) no
  longer throw and abort the whole script.
* **Copy Title** uses `navigator.clipboard.writeText()` with an
  `execCommand('copy')` `<textarea>` fallback, so it works in all three
  browsers including non-secure contexts.
* **Selection** uses CSS `user-select: all` instead of deprecated inline
  `oncontextmenu`/`onclick` handlers, so text can be selected and passed to
  NZBDonkey reliably.
* **Dynamic content** is handled with a debounced `MutationObserver`, and the
  forum's "thank you" handler is detoured so newly revealed posts are processed.
* **Scoped execution**: styles/UI are only injected on pages that actually
  contain Kooba post content.


## NZBDonkey integration
NZBDonkey extracts the title, header and password from **selected text**. The
highlight block is formatted to match its best-practice rules:

```
<title>
Header: <nzb header / subject>
Password: <password, if present>
```

* The title is always on the first line.
* The password is taken from the "Password" code box, whether it lives in the
  same container or a separate post block.
* Password-only code boxes do **not** get their own search links; they are
  folded into the main block's `Password:` line.
* The block is a `<pre>` with real newlines, so the copied/selected text is
  exactly what NZBDonkey parses.
