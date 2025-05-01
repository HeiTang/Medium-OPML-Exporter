// ==UserScript==
// @name         Medium OPML Exporter
// @namespace    https://purr.tw/
// @version      1.0.0
// @description  Export Medium Following to OPML。
// @author       HeiTang
// @match        *://*.medium.com/*/following*
// @match        *://*.medium.com/following*
// @match        *://medium.com/*/following*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    /* ——— 參數 ——— */
    const SCROLL_DELAY = 600;   // 每輪等待 ms
    const BTN_ID = "exportOpmlBtn";

    /* ——— 建立按鈕 ——— */
    function injectButton() {
        if (document.getElementById(BTN_ID)) return;
        const btn = Object.assign(document.createElement("button"), {
            id: BTN_ID,
            textContent: "📄 Export OPML",
            style: `
                position:fixed;top:1rem;right:1rem;z-index:2147483647;
                padding:.6rem 1rem;font-size:.9rem;background:#02b875;color:#fff;
                border:none;border-radius:.4rem;cursor:pointer;
                box-shadow:0 2px 6px rgba(0,0,0,.2);
                `
        });
        btn.onclick = handleExport;
        document.body.appendChild(btn);
    }

    /* ——— 主流程 ——— */
    async function handleExport() {
        await exhaustList();
        const entries = collectFeeds(); // 收集 People + Publications

        if (!entries.length)
            return alert("🤔 沒抓到任何項目");

        // 轉成 OPML 並下載
        download(buildOpml(entries));
    }

    /* ===== 1. 把整份 Followings 逼出來 ===== */
    async function exhaustList() {
        let prevCount = 0, stuckRounds = 0;
        while (true) {
            clickShowMoreIfAny();
            window.scrollTo(0, document.body.scrollHeight);

            const now = document.querySelectorAll('ul li a[href]').length;
            if (now === prevCount) stuckRounds++; else stuckRounds = 0;
            if (stuckRounds >= 3) break; // 3 連平視為載入完畢
            prevCount = now;

            await delay(SCROLL_DELAY);
        }
    }

    function clickShowMoreIfAny() {
        const btn = document.querySelector('button[data-action="show-more"]');
        if (btn) btn.click();
    }

    const delay = ms => new Promise(r => setTimeout(r, ms));

    /* ===== 2. 收集 People + Publications ===== 
    * 1. People:
    * ── https://medium.com/@username
    * ── https://{username}.medium.com
    * 
    * 2. Publications:
    * ── https://medium.com/{username}
    */
    function collectFeeds() {
        const entries = [];

        document.querySelectorAll('div.fz.ab').forEach(container => {

            let id = '';
            let type = '';

            const name = container.querySelector('h2')?.textContent?.trim() ?? '';
            const desc = container.querySelector('p')?.textContent?.trim() ?? '';
            const linkEl = container.querySelector('a[href]');

            if (!linkEl) return;
            const url = new URL(linkEl.href, location.origin);

            // 先判斷是 People 還是 Publications
            const mUser = url.pathname.match(/\/@([\w\d_.-]+)/);
            if (mUser) {
                type = 'People';
                id = mUser[1];
            } else {
                const mUser2 = url.hostname.match(/^([\w\d_.-]+)\.medium\.com/);
                if (mUser2) {
                    type = 'People';
                    id = mUser2[1];
                }
                else {
                    const mPub = url.pathname.match(/\/([\w\d_.-]+)/);
                    if (mPub) {
                        type = 'Publications';
                        id = mPub[1];
                    }
                }
            }

            if (id) {
                entries.push({ id, name, desc, type });
            }
        });

        console.log(entries);
        return entries;
    }

    /* ===== 3. 組 OPML ===== */
    function buildOpml(entries) {
        const today = new Date().toISOString().slice(0, 10);

        const peopleXML = entries
            .filter(e => e.type === "People")
            .sort((a, b) => a.id.localeCompare(b.id)) // 按 ID 排序
            .map(e => `<outline text="${e.name}" title="${e.desc}" type="rss" xmlUrl="https://medium.com/feed/@${e.id}"/>`)
            .join("\n      ");

        const pubXML = entries
            .filter(e => e.type === "Publications")
            .sort((a, b) => a.id.localeCompare(b.id)) // 按 ID 排序
            .map(e => `<outline text="${e.name}" title="${e.desc}" type="rss" xmlUrl="https://medium.com/feed/${e.id}"/>`)
            .join("\n      ");

        return `<?xml version="1.0" encoding="UTF-8"?>
            <opml version="2.0">
            <head><title>Medium Following (${today})</title></head>
            <body>
                <outline text="People" title="People">
                ${peopleXML}
                </outline>
                <outline text="Publications" title="Publications">
                ${pubXML}
                </outline>
            </body>
            </opml>`;
    }

    /* ===== 4. 下載 ===== */
    function download(xml) {
        const blob = new Blob([xml], { type: "text/xml" });
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement("a"), { href: url, download: `medium_following_${Date.now()}.opml` }).click();
        URL.revokeObjectURL(url);
    }

    /* ===== 5. SPA 路由監聽 ===== */
    function observeRoute() {
        const check = () => location.pathname.endsWith("/following") && injectButton();
        check();
        ["pushState", "replaceState"].forEach(fn => {
            const orig = history[fn]; history[fn] = function () { orig.apply(this, arguments); setTimeout(check, 200); };
        });
        window.addEventListener("popstate", () => setTimeout(check, 200));
    }

    observeRoute();
})();
