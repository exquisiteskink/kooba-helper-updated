// ==UserScript==
// @name         kooba-helper
// @namespace    kooba-helper@shrek
// @description  For a better kooba<=>abook experience. Adds search links to Abook forums code boxes, a "Copy Title" link, and NZBDonkey highlight text.
// @author       Shrek, rhymesagainsthumanity, pushr (original creator)
// @version      2023.10.27.2
// @updateURL    https://raw.githubusercontent.com/exquisiteskink/kooba-helper-updated/master/kooba-helper.meta.js
// @downloadURL  https://raw.githubusercontent.com/exquisiteskink/kooba-helper-updated/master/kooba-helper.user.js
// @supportURL   https://abook.link/book/index.php?topic=54768
// @include      *://abook.link/*
// @match        *://abook.link/*
// @run-at       document-end
// @grant        none
// ==/UserScript==


/**
 * Clean a raw code string for use as a query / display value.
 * Strips "abook/..." URL-style prefixes, quotes and repeated backslashes.
 *
 * @param {string} code
 * @returns {string}
 */
function sanitizeCommon(code) {
    if (!code) return '';
    let cleaned = code.replace(/(?:abook|kooba)\.*(?:to|link|ws)*\s*(?:-|\||~)*\s*/gi, '');
    cleaned = cleaned.replace(/['"]+/g, ' ');
    cleaned = cleaned.replace(/\\&+/g, ' ');
    return cleaned.trim();
}

/**
 * Resolve the text that belongs to a `.codeheader` element.
 *
 * Kooba/abook forum builds differ in how they lay out the codebox after a
 * `.codeheader`:
 *   - PostBot style has a `<br>` between the header and the codebox;
 *   - some builds insert a whitespace text node in between;
 *   - others place the codebox directly after the header.
 *
 * Whitespace text nodes are skipped so a stray newline never becomes the
 * "code" value. The first `.bbc_code` inside the following codebox is used
 * as the header text.
 *
 * @param {Element} header
 * @returns {string}
 */
function extractCodeText(header) {
    // Advance past any whitespace-only text nodes that follow the header.
    let probe = header.nextSibling;
    while (probe && probe.nodeType === 3 && !/\S/.test(probe.textContent || '')) {
        probe = probe.nextSibling;
    }
    if (!probe) return '';

    const nodeName = probe.nodeName && probe.nodeName.toUpperCase();

    if (nodeName === 'BR') {
        // PostBot style: <br> is followed by the codebox. Walk past any
        // whitespace text nodes to find the actual code element.
        let node = probe.nextSibling;
        while (node) {
            if (node.nodeType === 3) {
                const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
                if (text) return text;
            } else if (node.nodeType === 1) {
                const firstCode = node.querySelector ? node.querySelector('.bbc_code') : null;
                return (firstCode ? firstCode.textContent : node.textContent || '').trim();
            }
            node = node.nextSibling;
        }
        return '';
    }

    // New style: header immediately followed by a text node containing the code.
    if (probe.nodeType === 3) {
        return (probe.textContent || '').trim();
    }

    // Header followed by an element (e.g. the codebox div).
    const firstCode = probe.querySelector ? probe.querySelector('.bbc_code') : null;
    return (firstCode ? firstCode.textContent : probe.textContent || '').trim();
}

/**
 * Read the topic title from the `#author` block.
 *
 * @returns {string|null}
 */
function getTopicTitle() {
    const author = document.querySelector('#author');
    if (!author) return null;

    // In modern Kooba the `<a name="author">` element is followed by a text
    // node ("Topic: ...") and then the topic summary link.
    let node = author.nextSibling;
    if (node && node.nodeType === 3) {
        const match = (node.textContent || '').match(/Topic:(.*?)(?:\(Read)/i);
        if (match && match[1]) {
            return match[1].replace(/\[spot\]/gi, '').trim();
        }
    }

    // Fallback: look for any visible "Topic: ..." text in the author block.
    const text = author.textContent || '';
    const match = text.match(/Topic:(.*?)(?:\(Read)/i);
    if (match && match[1]) {
        return match[1].replace(/\[spot\]/gi, '').trim();
    }
    return null;
}

const indexers = [
    {
        name: 'NZBIndex',
        url: 'https://DoNotRefer.Me/#https://nzbindex.com/search?max=25&minage=&maxage=&hidespam=1&hidepassword=0&sort=agedesc&minsize=&maxsize=&complete=0&hidecross=0&hasNFO=0&poster=&q={query}',
        codeFn: function (code) { return sanitizeCommon(code); }
    },
    {
        name: 'BinSearch',
        url: 'https://DoNotRefer.Me/#https://www.binsearch.info/?max=1000&adv_age=&adv_sort=date&server=2&q={query}',
        codeFn: function (code) { return sanitizeCommon(code); }
    },
    {
        name: 'BinSearch-Abook',
        url: 'https://DoNotRefer.Me/#https://www.binsearch.info/?max=100&adv_g=alt.binaries.mp3.abooks&adv_age=&adv_sort=date&q={query}',
        codeFn: function (code) { return sanitizeCommon(code); }
    },
    {
        name: 'NZBKing',
        url: 'https://DoNotRefer.Me/#http://nzbking.com/search/?q=%22{query}%22',
        codeFn: function (code) { return sanitizeCommon(code); }
    }
];

/**
 * Build the HTML list of search-engine links for a piece of code.
 *
 * @param {string} code
 * @returns {string}
 */
function buildSearchLinks(code) {
    if (!code) return '';
    let list = '';
    indexers.forEach(function (indexer) {
        const query = encodeURIComponent(indexer.codeFn(code));
        const link = indexer.url.replace(/{query}/g, query);
        list +=
            '<li>' +
            '<a rel="noreferrer noopener" target="_blank" href="' + link + '">' +
            indexer.name +
            '</a>' +
            '</li>';
    });
    return list;
}

/**
 * Decide whether a `.codeheader` is a password label.
 *
 * The label can either be the header's own text (e.g. the header literally
 * reads "Password") or a previous sibling (e.g. an "NZB Password" heading).
 *
 * @param {Element} header
 * @returns {boolean}
 */
function isLikelyPasswordLabel(header) {
    // The header's own text is the strongest signal.
    const ownText = (header.textContent || '').trim().toLowerCase();
    if (ownText && ownText.indexOf('password') !== -1) return true;

    // Otherwise look at the preceding siblings (up to 5) for the word.
    let sibling = header.previousSibling;
    let count = 0;
    while (sibling && count < 5) {
        const text = (sibling.textContent || '').toLowerCase();
        if (text.indexOf('password') !== -1) return true;
        sibling = sibling.previousSibling;
        count++;
    }
    return false;
}

/**
 * A code block is a password when it contains the word "password".
 *
 * @param {string} code
 * @returns {boolean}
 */
function isPasswordCode(code) {
    return (code || '').toLowerCase().indexOf('password') !== -1;
}

/**
 * Decide whether a given `.codeheader`/code pair is really a password block
 * (as opposed to the NZB header block that should get search links).
 *
 * @param {Element} header
 * @param {string} code
 * @returns {boolean}
 */
function looksLikePasswordBlock(header, code) {
    if (isLikelyPasswordLabel(header)) return true;
    // A dedicated password codebox is short, single-line and mentions
    // "password". This avoids skipping a real NZB header whose subject just
    // happens to contain the word.
    return isPasswordCode(code) && code.indexOf('\n') === -1 && code.length < 100;
}

/**
 * Find the password that belongs to a main header: either the next
 * `.bbc_code` in the same container (the original layout) or the nearest
 * following password block in document order.
 *
 * @param {Element} header
 * @returns {string}
 */
function findPassword(header) {
    // 1) Scan the other code boxes in the same container.
    const parent = header.parentElement;
    const boxes = parent ? parent.querySelectorAll('.bbc_code') : [];
    for (let i = 1; i < boxes.length; i++) {
        const box = boxes[i];
        const text = (box.textContent || '').trim();
        if (isPasswordCode(text) || isLikelyPasswordLabel(box)) {
            return text;
        }
    }

    // 2) Fall back to the nearest password block after this header.
    const headers = Array.prototype.slice.call(document.querySelectorAll('.codeheader'));
    const index = headers.indexOf(header);
    for (let j = index + 1; j < headers.length; j++) {
        const candidate = headers[j];
        const text = extractCodeText(candidate);
        if (isLikelyPasswordLabel(candidate) || looksLikePasswordBlock(candidate, text)) {
            return text;
        }
    }
    return '';
}

/**
 * Create a "Copy Title" link and wire clipboard copy.
 *
 * @param {string} title
 * @param {Element} reference
 */
function createCopyTitleLink(title, reference) {
    const link = document.createElement('a');
    link.id = 'kooba-title-copy';
    link.className = 'kooba-title-copy';
    link.dataset.cipboard = title;
    link.title = 'Copy "' + title + '" to clipboard';
    link.textContent = ' [Copy]';
    link.addEventListener('click', function (event) {
        event.preventDefault();
        copyTextToClipboard(title);
        showCopiedFeedback();
    });
    if (reference) {
        reference.parentNode.insertBefore(link, reference.nextSibling);
    }
}

/**
 * Append an HTML string to an element (works around whitespace text nodes).
 *
 * @param {Element} anchor
 * @param {string} html
 */
function appendHtmlToAnchor(anchor, html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    while (template.content.firstChild) {
        anchor.appendChild(template.content.firstChild);
    }
}

/**
 * Remove a leading "Header:" / "Password:" label from a value so we don't
 * end up with "Password: Password: ...".
 *
 * @param {string} value
 * @param {string} label
 * @returns {string}
 */
function stripLabel(value, label) {
    if (!value) return '';
    // Only strip when the label is followed by a colon or whitespace, so a
    // password like "password-abc-xyz" keeps its content.
    const re = new RegExp('^\\s*' + label + '(?::\\s*|\\s+)', 'i');
    return value.replace(re, '').trim();
}

/**
 * The block NZBDonkey reads when the user selects it and chooses
 * "Get NZB File".
 *
 * NZBDonkey's best-practice rules are:
 *   1. Title on the first line;
 *   2. "Header: ..." line;
 *   3. "Password: ..." line (omitted when there is no password).
 *
 * The text is rendered with real newlines (not nested block elements) so the
 * selection text is exactly what NZBDonkey parses, in Chromium, Brave and
 * Firefox. `user-select: all` lets a single click select the whole block.
 *
 * @param {string} title
 * @param {string} header
 * @param {string} password
 * @returns {string}
 */
function buildNzbdonkeyBlock(title, header, password) {
    const headerLine = stripLabel(sanitizeCommon(header), 'header');
    const passwordLine = stripLabel(sanitizeCommon(password), 'password');

    const lines = [title];
    if (headerLine) lines.push('Header: ' + headerLine);
    if (passwordLine) lines.push('Password: ' + passwordLine);
    const body = lines.join('\n');

    return (
        '<div class="kooba-nzbdonkey">' +
        '<div class="kooba-nzbdonkey-title">NZBDonkey Highlight Text ' +
        '<a class="kooba-nzbdonkey-help" target="_blank" href="https://tensai75.github.io/NZBDonkey/" ' +
        'title="This extension lets you right-click the text below and choose \'Get NZB File\' ' +
        'to automatically find and process the NZB. Another extension is required.">?</a></div>' +
        '<pre class="kooba-nzbdonkey-text">' +
        body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
        '</pre>' +
        '</div>'
    );
}

/**
 * Inject the stylesheet once.
 */
function injectStyle() {
    if (document.getElementById('kooba-style')) return;
    const style = document.createElement('style');
    style.id = 'kooba-style';
    style.textContent = [
        '.kooba-search-links, .kooba-search-links span, .kooba-search-links ul, .kooba-search-links li { display: inline-block; }',
        '.kooba-search-links span { margin-left: .5em; }',
        '.kooba-search-links ul { list-style: none; margin: 0; padding-left: 0; }',
        '.kooba-search-links li { margin: 0; padding: 0; }',
        '.kooba-search-links li:not(:last-child):after { color: #ccc; content: "|"; }',
        '.kooba-search-links a { margin: 0; padding: 0 .5em; }',
        '.kooba-title-copy { color: #57aad2; }',
        '.kooba-title-copy:hover { text-decoration: underline; }',
        '.kooba-title-copy2 { margin-left: 30px; color: #9383e0; font-weight: normal; }',
        '.kooba-title-copy2:hover { text-decoration: underline; }',
        '.kooba-nzbdonkey { margin-top: 20px; border: 1px dotted yellow; padding: 10px; }',
        '.kooba-nzbdonkey-title { font-weight: bold; color: red; }',
        'a.kooba-nzbdonkey-help { text-decoration: none; color: #2196f3; border-bottom: 1px dotted #2196f3; }',
        '.kooba-nzbdonkey-text { font-size: 10px; font-weight: normal; font-family: monospace; color: #bb96e0; padding: 0 0 0 30px; margin: 0; white-space: pre-wrap; user-select: all; -moz-user-select: all; cursor: text; }'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
}

/**
 * Copy a string to the clipboard with a modern API fallback so it works in
 * Chromium, Brave and Firefox.
 *
 * @param {string} text
 */
function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () { /* fall through */ });
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
    } catch (err) { /* ignore */ }
    document.body.removeChild(textarea);
}

/**
 * Create the "Copy Title" link shown inside the search-links block.
 *
 * @param {string} title
 * @returns {Element}
 */
function makeCopyButton(title) {
    const link = document.createElement('a');
    link.className = 'kooba-title-copy2';
    link.dataset.cipboard = title;
    link.title = 'Copy "' + title + '" to clipboard';
    link.textContent = ' [Copy Title]';
    link.addEventListener('click', function (event) {
        event.preventDefault();
        copyTextToClipboard(title);
        showCopiedFeedback();
    });
    return link;
}

/**
 * Build and inject the Kooba block into a single `.codeheader`.
 *
 * @param {Element} header
 */
function buildKoobaBlock(header) {
    const code = extractCodeText(header);
    const pageTitle = getTopicTitle() || 'Untitled topic';

    // Skip password blocks entirely; they are folded into the main block's
    // "Password:" line instead of getting their own search links.
    if (looksLikePasswordBlock(header, code)) {
        header.classList.add('kooba_crunched');
        return;
    }

    const password = findPassword(header);

    const searchHtml =
        '<div class="kooba-search-links">' +
        '<span>Search:</span>' +
        '<ul>' + buildSearchLinks(code) + '</ul>' +
        '</div>';

    header.classList.add('kooba_crunched');
    appendHtmlToAnchor(header, searchHtml);
    header.insertAdjacentElement('beforeend', makeCopyButton(pageTitle));

    if (header.parentElement) {
        header.parentElement.insertAdjacentHTML('beforeend',
            buildNzbdonkeyBlock(pageTitle, code, password));
    }
}

/**
 * Find and process every `.codeheader` on the page exactly once.
 */
function processKoobaSearch() {
    const headers = document.querySelectorAll('.codeheader');
    for (let i = 0; i < headers.length; i++) {
        if (headers[i].classList.contains('kooba_crunched')) continue;
        buildKoobaBlock(headers[i]);
    }
}

/**
 * Insert the "Copy Title" link next to the topic title (if not done yet).
 */
function injectKoobaTitleCopy() {
    if (document.getElementById('kooba-title-copy')) return;
    const title = getTopicTitle();
    if (!title) return;
    createCopyTitleLink(title, document.querySelector('#author'));
}

/**
 * Show a small "Copied to clipboard" toast.
 */
let koobaToastTimer = null;
function showCopiedFeedback() {
    let toast = document.querySelector('.kooba-copied-feedback');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'kooba-copied-feedback';
        toast.textContent = 'Copied to clipboard';
        toast.style.cssText = 'position:fixed;top:10px;right:10px;background:rgba(0,0,0,.75);' +
            'color:yellow;padding:6px 10px;border-radius:4px;font-family:sans-serif;z-index:99999;';
        document.body.appendChild(toast);
    }
    toast.style.display = 'block';
    if (koobaToastTimer) clearTimeout(koobaToastTimer);
    koobaToastTimer = setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2000);
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

(function () {
    let styleReady = false;
    let scheduled = false;

    function run() {
        scheduled = false;
        if (document.querySelector('.codeheader') && !styleReady) {
            injectStyle();
            styleReady = true;
        }
        processKoobaSearch();
        injectKoobaTitleCopy();
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(run, 150);
    }

    // Initial pass (document-end: the DOM is ready).
    run();

    // Re-run when the page loads (late images/scripts can shift the layout).
    window.addEventListener('load', run, { once: true });

    // Pick up dynamically inserted posts (AJAX "thank you" / new page).
    if (window.MutationObserver) {
        const observer = new MutationObserver(schedule);
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    } else {
        setInterval(run, 5000);
    }

    // Detour the forum's thank-you handler so the block is rebuilt after a
    // new post is revealed.
    const sayThanks = window.saythanks;
    if (sayThanks && sayThanks.prototype && sayThanks.prototype.handleThankClick) {
        const original = sayThanks.prototype.handleThankClick;
        sayThanks.prototype.handleThankClick = function (oInput) {
            if (typeof original === 'function') original.call(this, oInput);
            setTimeout(run, 250);
            setTimeout(run, 1000);
            setTimeout(run, 3000);
            setTimeout(run, 8000);
        };
    }
})();
