/* =========================================================
   SHARED DIARY — PREMIUM SCRIPT
   Firebase + Firestore + Realtime Database + WebRTC
========================================================= */

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from
    "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    limit
} from
    "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    getDatabase,
    ref,
    set,
    onValue,
    onDisconnect,
    serverTimestamp as rtdbTimestamp
} from
    "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyBvrnbdz69356LOv3lWY-dFlIVZG8zdQ_4",
    authDomain: "notebock-d4ec7.firebaseapp.com",
    projectId: "notebock-d4ec7",
    storageBucket: "notebock-d4ec7.firebasestorage.app",
    messagingSenderId: "931492123706",
    appId: "1:931492123706:web:8ea75df636cc7118de9103",
    measurementId: "G-7VWTN1D47C",
    databaseURL:
        "https://notebock-d4ec7-default-rtdb.firebaseio.com/"
};


/* =========================================================
   FIREBASE INIT
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);


/* =========================================================
   APP CONFIG
========================================================= */

const FIXED_DIARY_CODE = "LOVE2026";

let currentUser = null;
let diaryId = null;
let currentName = "";

let partnerUid = null;
let partnerName = "";

let unsubscribeMessages = null;
let unsubscribeDiary = null;
let unsubscribeMembers = null;
let unsubscribeCalls = null;
let unsubscribeIncomingCandidates = null;
let unsubscribeOutgoingCandidates = null;

let currentMessages = [];
let currentDiaryEntries = [];

let localStream = null;
let remoteStream = null;
let peerConnection = null;

let currentCallId = null;
let currentCallType = null;
let currentCallRole = null;

let callTimerInterval = null;
let callStartedAt = null;

let batteryManager = null;


/* =========================================================
   WEBRTC CONFIG
========================================================= */

const rtcConfiguration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        }
    ]
};


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = id => document.getElementById(id);

const loginScreen = $("loginScreen");
const appScreen = $("appScreen");

const diaryCodeInput = $("diaryCode");
const userNameInput = $("userName");
const loginBtn = $("loginBtn");
const loginLoading = $("loginLoading");

const messagesContainer = $("messagesContainer");
const messageInput = $("messageInput");
const sendMessageBtn = $("sendMessageBtn");

const diaryInput = $("diaryInput");
const saveDiaryBtn = $("saveDiaryBtn");
const diaryList = $("diaryList");

const toast = $("toast");
const toastIcon = $("toastIcon");
const toastMessage = $("toastMessage");


/* =========================================================
   UTILITIES
========================================================= */

function normalizeDiaryCode(value) {
    return String(value || "")
        .trim()
        .toUpperCase();
}


function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function formatTime(timestamp) {

    if (!timestamp) {
        return "اکنون";
    }

    let date;

    if (timestamp?.toDate) {
        date = timestamp.toDate();
    } else {
        date = new Date(timestamp);
    }

    if (Number.isNaN(date.getTime())) {
        return "اکنون";
    }

    return date.toLocaleTimeString("fa-IR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}


function formatDate(timestamp) {

    if (!timestamp) {
        return "امروز";
    }

    let date;

    if (timestamp?.toDate) {
        date = timestamp.toDate();
    } else {
        date = new Date(timestamp);
    }

    if (Number.isNaN(date.getTime())) {
        return "امروز";
    }

    return date.toLocaleDateString("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}


function showToast(message, icon = "✓") {

    if (!toast) return;

    toastIcon.textContent = icon;
    toastMessage.textContent = message;

    toast.classList.add("show");

    clearTimeout(window.__toastTimer);

    window.__toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}


/* =========================================================
   LOADING
========================================================= */

function setLoginLoading(state) {

    if (!loginBtn) return;

    loginBtn.disabled = state;

    const text = loginBtn.querySelector(".btn-text");
    const arrow = loginBtn.querySelector(".btn-arrow");

    if (text) {
        text.hidden = state;
    }

    if (arrow) {
        arrow.hidden = state;
    }

    if (loginLoading) {
        loginLoading.hidden = !state;
    }
}


/* =========================================================
   LOCAL SESSION
========================================================= */

function saveSession() {

    localStorage.setItem(
        "sharedDiaryCode",
        diaryId
    );

    localStorage.setItem(
        "sharedDiaryName",
        currentName
    );
}


function clearSession() {

    localStorage.removeItem("sharedDiaryCode");
    localStorage.removeItem("sharedDiaryName");
}


/* =========================================================
   OPEN APP
========================================================= */

function openApp() {

    if (loginScreen) {
        loginScreen.hidden = true;
    }

    if (appScreen) {
        appScreen.hidden = false;
    }

    updateMyName();
    updateSettings();

    showPage("homePage");
}


/* =========================================================
   CLOSE APP
========================================================= */

function closeApp() {

    if (appScreen) {
        appScreen.hidden = true;
    }

    if (loginScreen) {
        loginScreen.hidden = false;
    }
}


/* =========================================================
   LOGIN
========================================================= */

async function login() {

    const code = normalizeDiaryCode(
        diaryCodeInput?.value
    );

    const name = userNameInput?.value.trim();

    if (!code) {
        showToast(
            "کد دفترچه را وارد کنید",
            "⚠️"
        );

        diaryCodeInput?.focus();
        return;
    }

    if (!name) {
        showToast(
            "نام خود را وارد کنید",
            "⚠️"
        );

        userNameInput?.focus();
        return;
    }

    if (code !== FIXED_DIARY_CODE) {

        showToast(
            "کد دفترچه اشتباه است",
            "❌"
        );

        diaryCodeInput?.focus();

        return;
    }

    setLoginLoading(true);

    try {

        if (!currentUser) {

            await signInAnonymously(auth);

            if (!currentUser) {
                await new Promise(resolve => {

                    const timeout = setTimeout(
                        resolve,
                        5000
                    );

                    const unsubscribe =
                        onAuthStateChanged(
                            auth,
                            user => {

                                if (user) {
                                    currentUser = user;
                                    clearTimeout(timeout);
                                    unsubscribe();
                                    resolve();
                                }

                            }
                        );

                });
            }
        }

        if (!currentUser) {
            throw new Error(
                "AUTH_FAILED"
            );
        }

        diaryId = code;
        currentName = name;

        await registerMember();

        saveSession();

        openApp();

        await setupEverything();

        showToast(
            "با موفقیت وارد شدید ❤️",
            "✓"
        );

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        showToast(
            "ورود انجام نشد؛ اتصال Firebase را بررسی کنید",
            "❌"
        );

    } finally {

        setLoginLoading(false);
    }
}


/* =========================================================
   REGISTER MEMBER
========================================================= */

async function registerMember() {

    if (!currentUser || !diaryId) {
        return;
    }

    const memberRef = doc(
        db,
        "diaries",
        diaryId,
        "members",
        currentUser.uid
    );

    await setDoc(
        memberRef,
        {
            uid: currentUser.uid,
            name: currentName,
            lastSeen: serverTimestamp()
        },
        {
            merge: true
        }
    );
}


/* =========================================================
   RESTORE SESSION
========================================================= */

async function restoreSession() {

    const savedCode =
        localStorage.getItem(
            "sharedDiaryCode"
        );

    const savedName =
        localStorage.getItem(
            "sharedDiaryName"
        );

    if (
        savedCode !== FIXED_DIARY_CODE ||
        !savedName
    ) {
        return;
    }

    if (!currentUser) {
        return;
    }

    diaryId = savedCode;
    currentName = savedName;

    try {

        await registerMember();

        if (diaryCodeInput) {
            diaryCodeInput.value = savedCode;
        }

        if (userNameInput) {
            userNameInput.value = savedName;
        }

        openApp();

        await setupEverything();

    } catch (error) {

        console.error(
            "Restore session error:",
            error
        );

        clearSession();
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    try {

        await cleanupCall();

    } catch (error) {
        console.warn(error);
    }

    stopRealtimeListeners();

    clearSession();

    currentName = "";
    diaryId = null;
    partnerUid = null;
    partnerName = "";

    if (diaryCodeInput) {
        diaryCodeInput.value = "";
        diaryCodeInput.readOnly = false;
    }

    if (userNameInput) {
        userNameInput.value = "";
    }

    closeApp();

    showToast(
        "از دفترچه خارج شدید",
        "✓"
    );
}


/* =========================================================
   UPDATE MY NAME
========================================================= */

function updateMyName() {

    const element = $("myName");

    if (element) {
        element.textContent =
            currentName || "—";
    }
}


/* =========================================================
   SETTINGS
========================================================= */

function updateSettings() {

    const nameElement =
        $("settingName");

    const codeElement =
        $("settingCode");

    if (nameElement) {
        nameElement.textContent =
            currentName || "—";
    }

    if (codeElement) {
        codeElement.textContent =
            diaryId || "—";
    }
}


/* =========================================================
   NAVIGATION
========================================================= */

function showPage(pageId) {

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.toggle(
                "active-page",
                page.id === pageId
            );

        });

    document
        .querySelectorAll(".nav-item")
        .forEach(item => {

            item.classList.toggle(
                "active",
                item.dataset.page === pageId
            );

        });

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function setupNavigation() {

    document
        .querySelectorAll("[data-page]")
        .forEach(item => {

            if (item.dataset.navReady === "1") {
                return;
            }

            item.dataset.navReady = "1";

            item.addEventListener(
                "click",
                () => {

                    const page =
                        item.dataset.page;

                    if (page) {
                        showPage(page);
                    }

                }
            );

        });
}


/* =========================================================
   THEME
========================================================= */

function applyTheme(theme) {

    const light =
        theme === "light";

    document.body.classList.toggle(
        "light-theme",
        light
    );

    localStorage.setItem(
        "diaryTheme",
        light ? "light" : "dark"
    );

    const icon =
        document.querySelector(
            ".theme-icon"
        );

    if (icon) {
        icon.textContent =
            light ? "☀" : "☾";
    }

    updateThemeSwitch();
}


function toggleTheme() {

    const isLight =
        document.body.classList.contains(
            "light-theme"
        );

    applyTheme(
        isLight ? "dark" : "light"
    );
}


function updateThemeSwitch() {

    const light =
        document.body.classList.contains(
            "light-theme"
        );

    const switches = [
        $("themeToggleSettings")
    ];

    switches.forEach(element => {

        if (!element) return;

        element.classList.toggle(
            "active",
            light
        );

    });
}


function loadTheme() {

    const saved =
        localStorage.getItem(
            "diaryTheme"
        );

    applyTheme(
        saved === "light"
            ? "light"
            : "dark"
    );
}


/* =========================================================
   CHAT SETUP
========================================================= */

function setupChat() {

    if (sendMessageBtn) {

        sendMessageBtn.onclick =
            sendMessage;

    }

    if (
        messageInput &&
        messageInput.dataset.chatReady !== "1"
    ) {

        messageInput.dataset.chatReady =
            "1";

        messageInput.addEventListener(
            "input",
            autoResizeTextarea
        );

        messageInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();
                    event.stopPropagation();

                    sendMessage();
                }

            }
        );

        autoResizeTextarea();
    }
}


/* =========================================================
   TEXTAREA RESIZE
========================================================= */

function autoResizeTextarea() {

    if (!messageInput) {
        return;
    }

    messageInput.style.height =
        "auto";

    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            115
        ) + "px";
}


/* =========================================================
   SEND MESSAGE
========================================================= */

let sendingMessage = false;

async function sendMessage() {

    if (sendingMessage) {
        return;
    }

    if (!currentUser || !diaryId) {
        showToast(
            "ابتدا وارد دفترچه شوید",
            "⚠️"
        );
        return;
    }

    const text =
        messageInput?.value.trim();

    if (!text) {
        return;
    }

    sendingMessage = true;

    if (sendMessageBtn) {
        sendMessageBtn.disabled = true;
    }

    try {

        await addDoc(
            collection(
                db,
                "diaries",
                diaryId,
                "messages"
            ),
            {
                senderUid: currentUser.uid,
                senderName: currentName,
                text: text,
                createdAt: serverTimestamp()
            }
        );

        messageInput.value = "";

        autoResizeTextarea();

    } catch (error) {

        console.error(
            "Send message:",
            error
        );

        showToast(
            "ارسال پیام ناموفق بود",
            "❌"
        );

    } finally {

        sendingMessage = false;

        if (sendMessageBtn) {
            sendMessageBtn.disabled = false;
        }
    }
}


/* =========================================================
   SUBSCRIBE MESSAGES
========================================================= */

function subscribeMessages() {

    if (!diaryId) return;

    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    const messagesRef =
        collection(
            db,
            "diaries",
            diaryId,
            "messages"
        );

    const messagesQuery =
        query(
            messagesRef,
            orderBy(
                "createdAt",
                "asc"
            ),
            limit(500)
        );

    unsubscribeMessages =
        onSnapshot(
            messagesQuery,
            snapshot => {

                currentMessages =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );

                renderMessages();
                updateMessageCount();

            },
            error => {

                console.error(
                    "Messages listener:",
                    error
                );

                showToast(
                    "خطا در دریافت پیام‌ها",
                    "❌"
                );
            }
        );
}


/* =========================================================
   RENDER MESSAGES
========================================================= */

function renderMessages() {

    if (!messagesContainer) {
        return;
    }

    if (!currentMessages.length) {

        messagesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💬</div>
                <h3>هنوز پیامی وجود ندارد</h3>
                <p>اولین پیام را شما بفرستید.</p>
            </div>
        `;

        return;
    }

    const fragment =
        document.createDocumentFragment();

    currentMessages.forEach(message => {

        const mine =
            message.senderUid ===
            currentUser?.uid;

        const row =
            document.createElement("div");

        row.className =
            `message-row ${
                mine ? "mine" : "theirs"
            }`;

        const bubble =
            document.createElement("div");

        bubble.className =
            "message-bubble";

        const name =
            document.createElement("span");

        name.className =
            "message-name";

        name.textContent =
            mine
                ? "شما"
                : message.senderName || "نفر دوم";

        const text =
            document.createElement("div");

        text.textContent =
            message.text || "";

        const time =
            document.createElement("span");

        time.className =
            "message-time";

        time.textContent =
            formatTime(
                message.createdAt
            );

        bubble.append(
            name,
            text,
            time
        );

        row.appendChild(bubble);

        fragment.appendChild(row);
    });

    messagesContainer.replaceChildren(
        fragment
    );

    requestAnimationFrame(() => {

        messagesContainer.scrollTop =
            messagesContainer.scrollHeight;

    });
}


/* =========================================================
   MESSAGE COUNT
========================================================= */

function updateMessageCount() {

    const element =
        $("messageCount");

    if (element) {
        element.textContent =
            currentMessages.length;
    }
}


/* =========================================================
   MEMBERS
========================================================= */

function subscribeMembers() {

    if (!diaryId) {
        return;
    }

    if (unsubscribeMembers) {
        unsubscribeMembers();
    }

    const membersRef =
        collection(
            db,
            "diaries",
            diaryId,
            "members"
        );

    unsubscribeMembers =
        onSnapshot(
            membersRef,
            snapshot => {

                let foundPartner = null;

                snapshot.forEach(
                    member => {

                        const data =
                            member.data();

                        if (
                            member.id !==
                            currentUser?.uid
                        ) {

                            foundPartner = {
                                uid: member.id,
                                ...data
                            };

                        }

                    }
                );

                if (foundPartner) {

                    partnerUid =
                        foundPartner.uid;

                    partnerName =
                        foundPartner.name ||
                        "نفر دوم";

                } else {

                    partnerUid = null;
                    partnerName = "";

                }

                updatePartnerUI();

            },
            error => {

                console.error(
                    "Members listener:",
                    error
                );
            }
        );
}


/* =========================================================
   PARTNER UI
========================================================= */

function updatePartnerUI() {

    const name =
        partnerName || "در انتظار...";

    const elements = [
        $("partnerName"),
        $("callPartnerName"),
        $("incomingCallerName")
    ];

    elements.forEach(
        element => {

            if (element) {
                element.textContent =
                    name;
            }

        }
    );
}


/* =========================================================
   PRESENCE
========================================================= */

function setupPresence() {

    if (!currentUser || !diaryId) {
        return;
    }

    const connectedRef =
        ref(
            rtdb,
            ".info/connected"
        );

    const presenceRef =
        ref(
            rtdb,
            `diaries/${diaryId}/presence/${currentUser.uid}`
        );

    onValue(
        connectedRef,
        snapshot => {

            if (snapshot.val() !== true) {
                return;
            }

            onDisconnect(
                presenceRef
            ).set({
                online: false,
                lastSeen:
                    rtdbTimestamp()
            });

            set(
                presenceRef,
                {
                    online: true,
                    name: currentName,
                    lastSeen:
                        rtdbTimestamp()
                }
            );

        }
    );

    const partnerPresence =
        ref(
            rtdb,
            `diaries/${diaryId}/presence`
        );

    onValue(
        partnerPresence,
        snapshot => {

            const data =
                snapshot.val() || {};

            let partner = null;

            Object.entries(data)
                .forEach(
                    ([uid, value]) => {

                        if (
                            uid !==
                            currentUser.uid
                        ) {

                            partner = {
                                uid,
                                ...value
                            };

                        }

                    }
                );

            updatePartnerPresence(
                partner
            );

        }
    );
}


/* =========================================================
   UPDATE PARTNER PRESENCE
========================================================= */

function updatePartnerPresence(
    presence
) {

    const status =
        $("partnerStatus");

    const statusText =
        $("partnerStatusText");

    const dot =
        $("partnerOnlineDot");

    const topDot =
        $("partnerStatusDot");

    const online =
        Boolean(
            presence?.online
        );

    if (status) {
        status.textContent =
            online
                ? "آنلاین"
                : "آفلاین";
    }

    if (statusText) {
        statusText.textContent =
            online
                ? "اکنون آنلاین است"
                : "آفلاین";
    }

    if (dot) {
        dot.style.background =
            online
                ? "var(--success)"
                : "#555";
    }

    if (topDot) {
        topDot.style.background =
            online
                ? "var(--success)"
                : "#555";
    }

    const chatStatus =
        $("chatStatus");

    if (chatStatus) {
        chatStatus.textContent =
            online
                ? "نفر دوم آنلاین است"
                : "نفر دوم آفلاین است";
    }
}


/* =========================================================
   BATTERY
========================================================= */

async function setupBattery() {

    if (
        !navigator.getBattery
    ) {
        return;
    }

    try {

        batteryManager =
            await navigator.getBattery();

        updateOwnBattery();

        batteryManager.addEventListener(
            "levelchange",
            updateOwnBattery
        );

        batteryManager.addEventListener(
            "chargingchange",
            updateOwnBattery
        );

    } catch (error) {

        console.warn(
            "Battery API unavailable:",
            error
        );
    }
}


function updateOwnBattery() {

    if (!batteryManager) {
        return;
    }

    const level =
        Math.round(
            batteryManager.level * 100
        );

    console.log(
        "Battery:",
        level + "%"
    );
}


/* =========================================================
   DIARY
========================================================= */

function subscribeDiary() {

    if (!diaryId) {
        return;
    }

    if (unsubscribeDiary) {
        unsubscribeDiary();
    }

    const diaryRef =
        collection(
            db,
            "diaries",
            diaryId,
            "entries"
        );

    const diaryQuery =
        query(
            diaryRef,
            orderBy(
                "createdAt",
                "desc"
            ),
            limit(200)
        );

    unsubscribeDiary =
        onSnapshot(
            diaryQuery,
            snapshot => {

                currentDiaryEntries =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );

                renderDiary();
                updateDiaryCount();

            },
            error => {

                console.error(
                    "Diary listener:",
                    error
                );
            }
        );
}


/* =========================================================
   SAVE DIARY
========================================================= */

let savingDiary = false;

async function saveDiary() {

    if (savingDiary) {
        return;
    }

    if (!currentUser || !diaryId) {
        return;
    }

    const text =
        diaryInput?.value.trim();

    if (!text) {

        showToast(
            "متن خاطره را بنویسید",
            "⚠️"
        );

        diaryInput?.focus();

        return;
    }

    savingDiary = true;

    if (saveDiaryBtn) {
        saveDiaryBtn.disabled = true;
    }

    try {

        await addDoc(
            collection(
                db,
                "diaries",
                diaryId,
                "entries"
            ),
            {
                authorUid:
                    currentUser.uid,

                authorName:
                    currentName,

                text,

                createdAt:
                    serverTimestamp()
            }
        );

        diaryInput.value = "";

        showToast(
            "خاطره ذخیره شد ✨",
            "✓"
        );

    } catch (error) {

        console.error(
            "Save diary:",
            error
        );

        showToast(
            "ذخیره خاطره ناموفق بود",
            "❌"
        );

    } finally {

        savingDiary = false;

        if (saveDiaryBtn) {
            saveDiaryBtn.disabled = false;
        }
    }
}


/* =========================================================
   RENDER DIARY
========================================================= */

function renderDiary() {

    if (!diaryList) {
        return;
    }

    if (!currentDiaryEntries.length) {

        diaryList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📖</div>
                <h3>هنوز خاطره‌ای ثبت نشده</h3>
                <p>اولین خاطره را ثبت کنید.</p>
            </div>
        `;

        return;
    }

    const fragment =
        document.createDocumentFragment();

    currentDiaryEntries.forEach(
        entry => {

            const item =
                document.createElement("article");

            item.className =
                "diary-item";

            const date =
                document.createElement("div");

            date.className =
                "diary-date";

            date.textContent =
                `${formatDate(
                    entry.createdAt
                )} • ${
                    entry.authorName ||
                    "عضو دفترچه"
                }`;

            const text =
                document.createElement("div");

            text.className =
                "diary-text";

            text.textContent =
                entry.text || "";

            item.append(
                date,
                text
            );

            fragment.appendChild(
                item
            );

        }
    );

    diaryList.replaceChildren(
        fragment
    );
}


/* =========================================================
   DIARY COUNT
========================================================= */

function updateDiaryCount() {

    const element =
        $("favoriteCount");

    if (element) {
        element.textContent =
            currentDiaryEntries.length;
    }
}


/* =========================================================
   DAYS COUNT
========================================================= */

async function updateDaysCount() {

    const element =
        $("daysCount");

    if (!element || !diaryId) {
        return;
    }

    try {

        const diaryRef =
            doc(
                db,
                "diaries",
                diaryId
            );

        const snapshot =
            await getDoc(diaryRef);

        if (!snapshot.exists()) {

            await setDoc(
                diaryRef,
                {
                    code: diaryId,
                    createdAt:
                        serverTimestamp()
                },
                {
                    merge: true
                }
            );

            element.textContent = "1";

            return;
        }

        const data =
            snapshot.data();

        if (!data.createdAt) {

            element.textContent = "1";

            return;
        }

        const created =
            data.createdAt.toDate();

        const now =
            new Date();

        const diff =
            Math.max(
                1,
                Math.floor(
                    (
                        now - created
                    ) /
                    86400000
                ) + 1
            );

        element.textContent =
            diff;

    } catch (error) {

        console.warn(
            "Days count:",
            error
        );

        element.textContent =
            "—";
    }
}


/* =========================================================
   CALL BUTTONS
========================================================= */

function setupCallButtons() {

    $("audioCallBtn")?.addEventListener(
        "click",
        () => startCall("audio")
    );

    $("videoCallBtn")?.addEventListener(
        "click",
        () => startCall("video")
    );

    $("acceptCallBtn")?.addEventListener(
        "click",
        acceptIncomingCall
    );

    $("rejectCallBtn")?.addEventListener(
        "click",
        rejectIncomingCall
    );

    $("endCallBtn")?.addEventListener(
        "click",
        endActiveCall
    );

    $("toggleMicBtn")?.addEventListener(
        "click",
        toggleMicrophone
    );

    $("toggleCameraBtn")?.addEventListener(
        "click",
        toggleCamera
    );
}


/* =========================================================
   START CALL
========================================================= */

async function startCall(type) {

    if (!currentUser || !diaryId) {
        return;
    }

    if (!partnerUid) {

        showToast(
            "نفر دوم هنوز وارد دفترچه نشده",
            "⚠️"
        );

        return;
    }

    if (currentCallId) {

        showToast(
            "در حال حاضر یک تماس فعال است",
            "⚠️"
        );

        return;
    }

    try {

        currentCallType = type;
        currentCallRole = "caller";

        const constraints =
            type === "video"
                ? {
                    audio: true,
                    video: true
                }
                : {
                    audio: true,
                    video: false
                };

        localStream =
            await navigator.mediaDevices
                .getUserMedia(
                    constraints
                );

        peerConnection =
            createPeerConnection();

        localStream
            .getTracks()
            .forEach(
                track => {

                    peerConnection.addTrack(
                        track,
                        localStream
                    );

                }
            );

        const callRef =
            doc(
                collection(
                    db,
                    "diaries",
                    diaryId,
                    "calls"
                )
            );

        currentCallId =
            callRef.id;

        const offer =
            await peerConnection.createOffer();

        await peerConnection.setLocalDescription(
            offer
        );

        await setDoc(
            callRef,
            {
                callerUid:
                    currentUser.uid,

                callerName:
                    currentName,

                calleeUid:
                    partnerUid,

                type,

                offer: {
                    type: offer.type,
                    sdp: offer.sdp
                },

                status:
                    "ringing",

                createdAt:
                    serverTimestamp()
            }
        );

        subscribeCallerCandidates(
            currentCallId
        );

        subscribeCallAnswer(
            currentCallId
        );

        showActiveCall(
            partnerName,
            type
        );

        showToast(
            "در حال برقراری تماس...",
            "📞"
        );

    } catch (error) {

        console.error(
            "Start call:",
            error
        );

        await cleanupCall();

        showToast(
            "دسترسی به میکروفون یا دوربین ممکن نبود",
            "❌"
        );
    }
}


/* =========================================================
   CREATE PEER CONNECTION
========================================================= */

function createPeerConnection() {

    const pc =
        new RTCPeerConnection(
            rtcConfiguration
        );

    pc.ontrack =
        event => {

            if (!remoteStream) {
                remoteStream =
                    new MediaStream();
            }

            event.streams[0]
                ?.getTracks()
                .forEach(
                    track => {

                        remoteStream.addTrack(
                            track
                        );

                    }
                );

            const video =
                $("remoteVideo");

            if (video) {
                video.srcObject =
                    remoteStream;
            }
        };


    pc.onicecandidate =
        async event => {

            if (
                !event.candidate ||
                !currentCallId
            ) {
                return;
            }

            const collectionName =
                currentCallRole === "caller"
                    ? "callerCandidates"
                    : "calleeCandidates";

            await addDoc(
                collection(
                    db,
                    "diaries",
                    diaryId,
                    "calls",
                    currentCallId,
                    collectionName
                ),
                event.candidate.toJSON()
            );
        };


    pc.onconnectionstatechange =
        async () => {

            const state =
                pc.connectionState;

            console.log(
                "WebRTC:",
                state
            );

            if (
                state === "connected"
            ) {

                startCallTimer();

                await updateCallStatus(
                    "active"
                );
            }

            if (
                state === "failed" ||
                state === "disconnected" ||
                state === "closed"
            ) {

                await cleanupCall();
            }
        };

    return pc;
}


/* =========================================================
   CALLER — ANSWER
========================================================= */

function subscribeCallAnswer(
    callId
) {

    const callRef =
        doc(
            db,
            "diaries",
            diaryId,
            "calls",
            callId
        );

    unsubscribeIncomingCandidates =
        onSnapshot(
            callRef,
            async snapshot => {

                if (!snapshot.exists()) {
                    return;
                }

                const data =
                    snapshot.data();

                if (
                    data.answer &&
                    peerConnection &&
                    !peerConnection
                        .currentRemoteDescription
                ) {

                    await peerConnection
                        .setRemoteDescription(
                            new RTCSessionDescription(
                                data.answer
                            )
                        );

                    subscribeCalleeCandidates(
                        callId
                    );
                }

                if (
                    data.status ===
                    "rejected"
                ) {

                    showToast(
                        "تماس رد شد",
                        "❌"
                    );

                    await cleanupCall();
                }

            }
        );
}


/* =========================================================
   CALLER CANDIDATES
========================================================= */

function subscribeCallerCandidates(
    callId
) {

    const candidatesRef =
        collection(
            db,
            "diaries",
            diaryId,
            "calls",
            callId,
            "calleeCandidates"
        );

    unsubscribeOutgoingCandidates =
        onSnapshot(
            candidatesRef,
            snapshot => {

                snapshot.docChanges()
                    .forEach(
                        async change => {

                            if (
                                change.type !==
                                "added"
                            ) {
                                return;
                            }

                            try {

                                await peerConnection
                                    ?.addIceCandidate(
                                        new RTCIceCandidate(
                                            change.doc.data()
                                        )
                                    );

                            } catch (error) {

                                console.warn(
                                    "ICE candidate:",
                                    error
                                );
                            }

                        }
                    );

            }
        );
}


/* =========================================================
   CALLEE CANDIDATES
========================================================= */

function subscribeCalleeCandidates(
    callId
) {

    const candidatesRef =
        collection(
            db,
            "diaries",
            diaryId,
            "calls",
            callId,
            "callerCandidates"
        );

    unsubscribeIncomingCandidates =
        onSnapshot(
            candidatesRef,
            snapshot => {

                snapshot.docChanges()
                    .forEach(
                        async change => {

                            if (
                                change.type !==
                                "added"
                            ) {
                                return;
                            }

                            try {

                                await peerConnection
                                    ?.addIceCandidate(
                                        new RTCIceCandidate(
                                            change.doc.data()
                                        )
                                    );

                            } catch (error) {

                                console.warn(
                                    "ICE candidate:",
                                    error
                                );
                            }

                        }
                    );

            }
        );
}


/* =========================================================
   SUBSCRIBE INCOMING CALLS
========================================================= */

function subscribeIncomingCalls() {

    if (!diaryId || !currentUser) {
        return;
    }

    if (unsubscribeCalls) {
        unsubscribeCalls();
    }

    const callsRef =
        collection(
            db,
            "diaries",
            diaryId,
            "calls"
        );

    unsubscribeCalls =
        onSnapshot(
            callsRef,
            snapshot => {

                snapshot.docChanges()
                    .forEach(
                        change => {

                            const data =
                                change.doc.data();

                            if (
                                change.type !==
                                "added"
                            ) {
                                return;
                            }

                            if (
                                data.calleeUid !==
                                currentUser.uid
                            ) {
                                return;
                            }

                            if (
                                data.status !==
                                "ringing"
                            ) {
                                return;
                            }

                            if (
                                currentCallId
                            ) {
                                return;
                            }

                            showIncomingCall(
                                change.doc.id,
                                data
                            );

                        }
                    );

            },
            error => {

                console.error(
                    "Incoming calls:",
                    error
                );
            }
        );
}


/* =========================================================
   SHOW INCOMING CALL
========================================================= */

function showIncomingCall(
    callId,
    data
) {

    currentCallId =
        callId;

    currentCallType =
        data.type;

    currentCallRole =
        "callee";

    const modal =
        $("incomingCall");

    const caller =
        $("incomingCallerName");

    const type =
        $("incomingCallType");

    if (caller) {
        caller.textContent =
            data.callerName ||
            "نفر دوم";
    }

    if (type) {
        type.textContent =
            data.type === "video"
                ? "تماس تصویری"
                : "تماس صوتی";
    }

    if (modal) {
        modal.hidden = false;
    }
}


/* =========================================================
   ACCEPT CALL
========================================================= */

async function acceptIncomingCall() {

    if (
        !currentCallId ||
        !currentUser
    ) {
        return;
    }

    try {

        const callRef =
            doc(
                db,
                "diaries",
                diaryId,
                "calls",
                currentCallId
            );

        const snapshot =
            await getDoc(callRef);

        if (!snapshot.exists()) {
            throw new Error(
                "CALL_NOT_FOUND"
            );
        }

        const data =
            snapshot.data();

        const constraints =
            data.type === "video"
                ? {
                    audio: true,
                    video: true
                }
                : {
                    audio: true,
                    video: false
                };

        localStream =
            await navigator.mediaDevices
                .getUserMedia(
                    constraints
                );

        peerConnection =
            createPeerConnection();

        localStream
            .getTracks()
            .forEach(
                track => {

                    peerConnection.addTrack(
                        track,
                        localStream
                    );

                }
            );

        await peerConnection
            .setRemoteDescription(
                new RTCSessionDescription(
                    data.offer
                )
            );

        const answer =
            await peerConnection
                .createAnswer();

        await peerConnection
            .setLocalDescription(
                answer
            );

        await updateDoc(
            callRef,
            {
                answer: {
                    type: answer.type,
                    sdp: answer.sdp
                },

                status:
                    "accepted"
            }
        );

        subscribeCallerCandidates(
            currentCallId
        );

        hideIncomingCall();

        showActiveCall(
            data.callerName ||
            "نفر دوم",
            data.type
        );

    } catch (error) {

        console.error(
            "Accept call:",
            error
        );

        await cleanupCall();

        showToast(
            "برقراری تماس ممکن نشد",
            "❌"
        );
    }
}


/* =========================================================
   REJECT CALL
========================================================= */

async function rejectIncomingCall() {

    if (!currentCallId) {
        hideIncomingCall();
        return;
    }

    try {

        await updateDoc(
            doc(
                db,
                "diaries",
                diaryId,
                "calls",
                currentCallId
            ),
            {
                status:
                    "rejected"
            }
        );

    } catch (error) {

        console.warn(
            "Reject call:",
            error
        );

    } finally {

        hideIncomingCall();

        currentCallId = null;
        currentCallType = null;
        currentCallRole = null;
    }
}


/* =========================================================
   HIDE INCOMING CALL
========================================================= */

function hideIncomingCall() {

    const modal =
        $("incomingCall");

    if (modal) {
        modal.hidden = true;
    }
}


/* =========================================================
   UPDATE CALL STATUS
========================================================= */

async function updateCallStatus(
    status
) {

    if (
        !currentCallId ||
        !diaryId
    ) {
        return;
    }

    try {

        await updateDoc(
            doc(
                db,
                "diaries",
                diaryId,
                "calls",
                currentCallId
            ),
            {
                status
            }
        );

    } catch (error) {

        console.warn(
            "Call status:",
            error
        );
    }
}


/* =========================================================
   SHOW ACTIVE CALL
========================================================= */

function showActiveCall(
    name,
    type
) {

    const activeCall =
        $("activeCall");

    const nameElement =
        $("activeCallName");

    const localVideo =
        $("localVideo");

    if (nameElement) {
        nameElement.textContent =
            name || "نفر دوم";
    }

    if (localVideo && localStream) {

        localVideo.srcObject =
            localStream;

        localVideo.style.display =
            type === "video"
                ? "block"
                : "none";
    }

    if (activeCall) {
        activeCall.hidden = false;
    }

    callStartedAt =
        Date.now();

    startCallTimer();
}


/* =========================================================
   CALL TIMER
========================================================= */

function startCallTimer() {

    clearInterval(
        callTimerInterval
    );

    callStartedAt =
        callStartedAt ||
        Date.now();

    callTimerInterval =
        setInterval(
            () => {

                const element =
                    $("activeCallTimer");

                if (!element) {
                    return;
                }

                const seconds =
                    Math.floor(
                        (
                            Date.now() -
                            callStartedAt
                        ) / 1000
                    );

                const minutes =
                    Math.floor(
                        seconds / 60
                    );

                const remaining =
                    seconds % 60;

                element.textContent =
                    `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;

            },
            1000
        );
}


/* =========================================================
   TOGGLE MICROPHONE
========================================================= */

function toggleMicrophone() {

    if (!localStream) {
        return;
    }

    const track =
        localStream.getAudioTracks()[0];

    if (!track) {
        return;
    }

    track.enabled =
        !track.enabled;

    const button =
        $("toggleMicBtn");

    if (button) {

        button.classList.toggle(
            "active",
            track.enabled
        );

        button.textContent =
            track.enabled
                ? "🎙️"
                : "🔇";
    }
}


/* =========================================================
   TOGGLE CAMERA
========================================================= */

function toggleCamera() {

    if (!localStream) {
        return;
    }

    const track =
        localStream.getVideoTracks()[0];

    if (!track) {
        return;
    }

    track.enabled =
        !track.enabled;

    const button =
        $("toggleCameraBtn");

    if (button) {

        button.classList.toggle(
            "active",
            track.enabled
        );

        button.textContent =
            track.enabled
                ? "📹"
                : "🚫";
    }
}


/* =========================================================
   END CALL
========================================================= */

async function endActiveCall() {

    await updateCallStatus(
        "ended"
    );

    await cleanupCall();
}


/* =========================================================
   CLEANUP CALL
========================================================= */

async function cleanupCall() {

    clearInterval(
        callTimerInterval
    );

    callTimerInterval = null;

    if (unsubscribeIncomingCandidates) {
        unsubscribeIncomingCandidates();
        unsubscribeIncomingCandidates = null;
    }

    if (unsubscribeOutgoingCandidates) {
        unsubscribeOutgoingCandidates();
        unsubscribeOutgoingCandidates = null;
    }

    if (peerConnection) {

        try {
            peerConnection.close();
        } catch (error) {
            console.warn(error);
        }

        peerConnection = null;
    }

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

        localStream = null;
    }

    remoteStream = null;

    const localVideo =
        $("localVideo");

    const remoteVideo =
        $("remoteVideo");

    if (localVideo) {
        localVideo.srcObject = null;
    }

    if (remoteVideo) {
        remoteVideo.srcObject = null;
    }

    const activeCall =
        $("activeCall");

    if (activeCall) {
        activeCall.hidden = true;
    }

    hideIncomingCall();

    currentCallId = null;
    currentCallType = null;
    currentCallRole = null;

    callStartedAt = null;
}


/* =========================================================
   REALTIME LISTENERS CLEANUP
========================================================= */

function stopRealtimeListeners() {

    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }

    if (unsubscribeDiary) {
        unsubscribeDiary();
        unsubscribeDiary = null;
    }

    if (unsubscribeMembers) {
        unsubscribeMembers();
        unsubscribeMembers = null;
    }

    if (unsubscribeCalls) {
        unsubscribeCalls();
        unsubscribeCalls = null;
    }
}


/* =========================================================
   SETUP EVERYTHING
========================================================= */

let setupFinished = false;

async function setupEverything() {

    if (!currentUser || !diaryId) {
        return;
    }

    setupNavigation();
    setupChat();

    subscribeMessages();
    subscribeDiary();
    subscribeMembers();
    subscribeIncomingCalls();

    setupPresence();
    setupBattery();

    await updateDaysCount();

    setupFinished = true;
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupGlobalEvents() {

    loginBtn?.addEventListener(
        "click",
        login
    );

    diaryCodeInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {
                event.preventDefault();
                login();
            }

        }
    );

    userNameInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {
                event.preventDefault();
                login();
            }

        }
    );

    $("logoutBtn")?.addEventListener(
        "click",
        logout
    );

    $("themeToggle")?.addEventListener(
        "click",
        toggleTheme
    );

    $("themeToggleSettings")
        ?.addEventListener(
            "click",
            toggleTheme
        );

    saveDiaryBtn?.addEventListener(
        "click",
        saveDiary
    );

    setupCallButtons();
}


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        currentUser = user;

        if (user) {

            await restoreSession();

        }

    }
);


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadTheme();

        setupGlobalEvents();

        if (diaryCodeInput) {
            diaryCodeInput.readOnly =
                false;
        }

    }
);


/* =========================================================
   PREVENT ACCIDENTAL DOUBLE SUBMIT
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        try {

            if (
                currentUser &&
                diaryId
            ) {

                const presenceRef =
                    ref(
                        rtdb,
                        `diaries/${diaryId}/presence/${currentUser.uid}`
                    );

                set(
                    presenceRef,
                    {
                        online: false,
                        lastSeen:
                            rtdbTimestamp()
                    }
                );

            }

        } catch (error) {
            console.warn(error);
        }

    }
);
