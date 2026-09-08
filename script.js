/* =========================================================
   SHARED DIARY
   Firebase + Firestore + Realtime Database
   ========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    limit
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
    getDatabase,
    ref,
    set,
    onValue,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";


/* =========================================================
   CONFIG
   ========================================================= */

/*
   کد دفترچه فقط اینجاست.
   در index.html هیچ فیلدی برای نمایش آن وجود ندارد.
*/

const DIARY_CODE = "asna&amir8890";


const firebaseConfig = {
    apiKey: "AIzaSyBvrnbdz69356LOv3LwY-dFlIVZG8zdQ_4",
    authDomain: "notebock-d4ec7.firebaseapp.com",
    projectId: "notebock-d4ec7",
    storageBucket: "notebock-d4ec7.firebasestorage.app",
    messagingSenderId: "931492123706",
    appId: "1:931492123706:web:8ea75df636cc7118de9103",
    measurementId: "G-7VWTN1D47C",
    databaseURL: "https://notebock-d4ec7-default-rtdb.firebaseio.com/"
};


/* =========================================================
   FIREBASE
   ========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const realtimeDB = getDatabase(app);


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;

let currentName = "";

let diaryId = DIARY_CODE;

let otherMember = null;

let members = [];

let unsubscribeMessages = null;

let unsubscribeMembers = null;

let unsubscribeOtherPresence = null;

let unsubscribeOtherBattery = null;

let batteryObject = null;


/* =========================================================
   HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);


function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text ?? "";

    return div.innerHTML;
}


function showToast(message) {

    const toast = $("toast");

    const text = $("toastText");

    if (!toast || !text) return;

    text.textContent = message;

    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {

        toast.classList.remove("show");

    }, 2800);
}


function formatTime(timestamp) {

    if (!timestamp) return "";

    try {

        const date =
            timestamp.toDate
                ? timestamp.toDate()
                : new Date(timestamp);

        return date.toLocaleTimeString("fa-IR", {
            hour: "2-digit",
            minute: "2-digit"
        });

    } catch {

        return "";

    }
}


function formatDate(timestamp) {

    if (!timestamp) return "";

    try {

        const date =
            timestamp.toDate
                ? timestamp.toDate()
                : new Date(timestamp);

        return date.toLocaleDateString("fa-IR");

    } catch {

        return "";

    }
}


/* =========================================================
   THEME
   ========================================================= */

function setupTheme() {

    const savedTheme =
        localStorage.getItem("diary-theme");

    if (savedTheme === "dark") {

        document.body.classList.add("dark");

    }

    updateThemeButtons();

    $("themeToggle")?.addEventListener(
        "click",
        toggleTheme
    );

    $("darkModeToggle")?.addEventListener(
        "change",
        event => {

            if (event.target.checked) {

                document.body.classList.add("dark");

                localStorage.setItem(
                    "diary-theme",
                    "dark"
                );

            } else {

                document.body.classList.remove("dark");

                localStorage.setItem(
                    "diary-theme",
                    "light"
                );

            }

            updateThemeButtons();

        }
    );
}


function toggleTheme() {

    document.body.classList.toggle("dark");

    const isDark =
        document.body.classList.contains("dark");

    localStorage.setItem(
        "diary-theme",
        isDark ? "dark" : "light"
    );

    updateThemeButtons();
}


function updateThemeButtons() {

    const isDark =
        document.body.classList.contains("dark");

    if ($("themeToggle")) {

        $("themeToggle").textContent =
            isDark ? "☀️" : "🌙";

    }

    if ($("darkModeToggle")) {

        $("darkModeToggle").checked = isDark;

    }
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

    document.querySelectorAll("[data-page]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const pageId =
                        button.dataset.page;

                    openPage(pageId);

                }
            );

        });

}


function openPage(pageId) {

    document.querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove("active");

        });


    const target =
        $(pageId);

    if (target) {

        target.classList.add("active");

    }


    document.querySelectorAll(".nav-btn")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === pageId
            );

        });

}


/* =========================================================
   LOGIN
   ========================================================= */

async function login() {

    const nameInput =
        $("userName");

    const name =
        nameInput.value.trim();

    if (!name) {

        showToast(
            "لطفاً نام خودتان را وارد کنید."
        );

        nameInput.focus();

        return;

    }


    if (name.length < 2) {

        showToast(
            "نام واردشده خیلی کوتاه است."
        );

        return;

    }


    const loginButton =
        $("loginBtn");

    loginButton.disabled = true;

    loginButton.innerHTML =
        "در حال ورود...";


    try {

        /*
          Anonymous Authentication
        */

        if (!auth.currentUser) {

            await signInAnonymously(auth);

        }


        currentUser =
            auth.currentUser;


        currentName =
            name;


        localStorage.setItem(
            "diary-name",
            currentName
        );


        /*
          عضو فعلی
        */

        const memberRef =
            doc(
                db,
                "diaries",
                diaryId,
                "members",
                currentUser.uid
            );


        let memberSnapshot;


        try {

            memberSnapshot =
                await getDoc(memberRef);

        } catch (error) {

            /*
              اگر اولین ورود باشد و Rule اجازه read
              قبل از عضویت ندهد، مستقیم create می‌کنیم.
            */

            if (
                error.code !==
                "permission-denied"
            ) {

                throw error;

            }

            memberSnapshot = null;

        }


        if (!memberSnapshot?.exists()) {

            await setDoc(
                memberRef,
                {
                    uid: currentUser.uid,
                    name: currentName,
                    joinedAt: serverTimestamp(),
                    lastSeen: serverTimestamp()
                }
            );

        } else {

            await updateDoc(
                memberRef,
                {
                    name: currentName,
                    lastSeen: serverTimestamp()
                }
            );

        }


        localStorage.setItem(
            "diary-logged-in",
            "true"
        );


        showApp();


        startServices();


        showToast(
            "خوش آمدی ❤️"
        );


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        showToast(
            firebaseErrorMessage(error)
        );

    } finally {

        loginButton.disabled = false;

        loginButton.innerHTML =
            "<span>ورود به دفترچه</span><span>✨</span>";

    }

}


/* =========================================================
   FIREBASE ERROR
   ========================================================= */

function firebaseErrorMessage(error) {

    if (!error) {

        return "یک خطای ناشناخته رخ داد.";

    }


    const code =
        error.code || "";


    if (
        code.includes("permission-denied")
    ) {

        return "دسترسی به دفترچه امکان‌پذیر نیست.";

    }


    if (
        code.includes("network")
    ) {

        return "اتصال اینترنت را بررسی کنید.";

    }


    if (
        code.includes("auth/operation-not-allowed")
    ) {

        return "Anonymous Authentication در Firebase فعال نیست.";

    }


    if (
        code.includes("auth/network-request-failed")
    ) {

        return "ارتباط با Firebase برقرار نشد.";

    }


    return (
        error.message ||
        "خطایی رخ داد."
    );

}


/* =========================================================
   AUTO LOGIN
   ========================================================= */

async function restoreSession() {

    const savedName =
        localStorage.getItem("diary-name");

    const loggedIn =
        localStorage.getItem(
            "diary-logged-in"
        );


    if (!savedName || loggedIn !== "true") {

        return;

    }


    $("userName").value =
        savedName;


    try {

        if (!auth.currentUser) {

            await signInAnonymously(auth);

        }


        currentUser =
            auth.currentUser;

        currentName =
            savedName;


        const memberRef =
            doc(
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


        showApp();

        startServices();


    } catch (error) {

        console.error(error);

        localStorage.removeItem(
            "diary-logged-in"
        );

    }

}


/* =========================================================
   SHOW APP
   ========================================================= */

function showApp() {

    $("loginScreen")
        .classList.add("hidden");

    $("appScreen")
        .classList.remove("hidden");


    $("myName").textContent =
        currentName;

    $("settingsName").textContent =
        currentName;

}


/* =========================================================
   MEMBERS
   ========================================================= */

function subscribeMembers() {

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

                members =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );


                otherMember =
                    members.find(
                        member =>
                            member.uid !==
                            currentUser.uid
                    ) || null;


                if (otherMember) {

                    $("otherName").textContent =
                        otherMember.name;

                    $("chatPartnerName").textContent =
                        otherMember.name;


                    subscribeOtherPresence();

                    updateOnlineStatus();

                } else {

                    $("otherName").textContent =
                        "نفر دیگر";

                    $("chatPartnerName").textContent =
                        "نفر دیگر";

                    $("chatOnlineStatus").textContent =
                        "منتظر اتصال نفر دیگر";

                }


                updateStats();

            },
            error => {

                console.error(
                    "Members:",
                    error
                );

            }
        );

}


/* =========================================================
   MESSAGES
   ========================================================= */

function subscribeMessages() {

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
            )
        );


    unsubscribeMessages =
        onSnapshot(
            messagesQuery,
            snapshot => {

                renderMessages(
                    snapshot.docs
                );

                updateStats(
                    snapshot.docs
                );

            },
            error => {

                console.error(
                    "Messages:",
                    error
                );

                showToast(
                    "دریافت پیام‌ها با مشکل مواجه شد."
                );

            }
        );

}


/* =========================================================
   RENDER MESSAGES
   ========================================================= */

function renderMessages(docs) {

    const container =
        $("messages");

    if (!container) return;


    if (!docs.length) {

        container.innerHTML = `
            <div class="empty-chat">
                <div>💌</div>
                <h3>هنوز پیامی ندارید</h3>
                <p>اولین پیام را شما بفرستید.</p>
            </div>
        `;

        return;

    }


    container.innerHTML = "";


    docs.forEach(item => {

        const data =
            item.data();

        const mine =
            data.senderUid ===
            currentUser.uid;


        const message =
            document.createElement("div");


        message.className =
            "message " +
            (
                mine
                    ? "mine"
                    : "other"
            );


        message.innerHTML = `

            <div>
                ${escapeHTML(
                    data.text || ""
                )}
            </div>

            <div class="message-meta">
                ${escapeHTML(
                    data.senderName || ""
                )}
                ${data.createdAt
                    ? " • " +
                      formatTime(
                          data.createdAt
                      )
                    : ""}
            </div>

        `;


        container.appendChild(
            message
        );

    });


    container.scrollTop =
        container.scrollHeight;

}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

    const input =
        $("messageInput");

    const text =
        input.value.trim();


    if (!text) return;


    if (!currentUser) {

        showToast(
            "ابتدا وارد دفترچه شوید."
        );

        return;

    }


    const button =
        $("sendMessageBtn");

    button.disabled = true;


    try {

        await addDoc(
            collection(
                db,
                "diaries",
                diaryId,
                "messages"
            ),
            {
                senderUid:
                    currentUser.uid,

                senderName:
                    currentName,

                text:
                    text,

                favorite:
                    false,

                createdAt:
                    serverTimestamp()
            }
        );


        input.value = "";

        input.style.height =
            "42px";


    } catch (error) {

        console.error(
            "Send:",
            error
        );

        showToast(
            firebaseErrorMessage(error)
        );

    } finally {

        button.disabled = false;

        input.focus();

    }

}


/* =========================================================
   TEXTAREA
   ========================================================= */

function setupChat() {

    $("sendMessageBtn")
        ?.addEventListener(
            "click",
            sendMessage
        );


    $("messageInput")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    sendMessage();

                }

            }
        );


    $("messageInput")
        ?.addEventListener(
            "input",
            event => {

                const textarea =
                    event.target;

                textarea.style.height =
                    "42px";

                textarea.style.height =
                    Math.min(
                        textarea.scrollHeight,
                        100
                    ) + "px";

            }
        );

}


/* =========================================================
   STATS
   ========================================================= */

async function updateStats(
    messageDocs = null
) {

    try {

        let docs =
            messageDocs;


        if (!docs) {

            const snapshot =
                await getDocs(
                    collection(
                        db,
                        "diaries",
                        diaryId,
                        "messages"
                    )
                );

            docs =
                snapshot.docs;

        }


        const total =
            docs.length;


        const favorites =
            docs.filter(
                item =>
                    item.data().favorite === true
            ).length;


        const days =
            new Set(
                docs
                    .map(item =>
                        item.data().createdAt
                            ? formatDate(
                                item.data().createdAt
                            )
                            : null
                    )
                    .filter(Boolean)
            ).size;


        $("memoryCount").textContent =
            total;

        $("favoriteCount").textContent =
            favorites;

        $("daysCount").textContent =
            days;


    } catch (error) {

        console.error(
            "Stats:",
            error
        );

    }

}


/* =========================================================
   BATTERY
   ========================================================= */

async function setupBattery() {

    if (
        !("getBattery" in navigator)
    ) {

        $("myBatteryText").textContent =
            "نامشخص";

        $("myCharging").textContent =
            "مرورگر باتری را ارائه نمی‌کند.";

        return;

    }


    try {

        batteryObject =
            await navigator.getBattery();


        updateMyBattery();

        writeMyPresence();


        batteryObject.addEventListener(
            "levelchange",
            () => {

                updateMyBattery();

                writeMyPresence();

            }
        );


        batteryObject.addEventListener(
            "chargingchange",
            () => {

                updateMyBattery();

                writeMyPresence();

            }
        );


        /*
          هر 30 ثانیه وضعیت دوباره
          روی Firebase نوشته می‌شود.
        */

        setInterval(
            writeMyPresence,
            30000
        );


    } catch (error) {

        console.error(
            "Battery:",
            error
        );

    }

}


function updateMyBattery() {

    if (!batteryObject) return;


    const level =
        Math.round(
            batteryObject.level * 100
        );


    const charging =
        batteryObject.charging;


    $("myBatteryText").textContent =
        `${level}%`;


    $("myBatteryFill").style.width =
        `${level}%`;


    $("myCharging").textContent =
        charging
            ? "⚡ در حال شارژ"
            : "در حال استفاده";


    updateOnlineStatus();

}


async function writeMyPresence() {

    if (
        !currentUser ||
        !batteryObject
    ) return;


    const presenceRef =
        ref(
            realtimeDB,
            `diaries/${diaryId}/presence/${currentUser.uid}`
        );


    const data = {

        online: true,

        name: currentName,

        battery:
            Math.round(
                batteryObject.level * 100
            ),

        charging:
            batteryObject.charging,

        updatedAt:
            Date.now()

    };


    try {

        await set(
            presenceRef,
            data
        );


        onDisconnect(
            presenceRef
        ).set({
            online: false,
            name: currentName,
            updatedAt: Date.now()
        });

    } catch (error) {

        console.error(
            "Presence:",
            error
        );

    }

}


/* =========================================================
   PARTNER PRESENCE
   ========================================================= */

function subscribeOtherPresence() {

    if (!otherMember) return;


    if (unsubscribeOtherPresence) {

        unsubscribeOtherPresence();

        unsubscribeOtherPresence = null;

    }


    const presenceRef =
        ref(
            realtimeDB,
            `diaries/${diaryId}/presence/${otherMember.uid}`
        );


    unsubscribeOtherPresence =
        onValue(
            presenceRef,
            snapshot => {

                const data =
                    snapshot.val();


                if (!data) {

                    setPartnerOffline();

                    return;

                }


                updatePartnerBattery(
                    data
                );


                if (data.online) {

                    $("chatOnlineStatus").textContent =
                        "آنلاین";

                } else {

                    $("chatOnlineStatus").textContent =
                        "آفلاین";

                }

            },
            error => {

                console.error(
                    "Partner presence:",
                    error
                );

            }
        );

}


function updatePartnerBattery(data) {

    const level =
        Number.isFinite(
            Number(data.battery)
        )
            ? Number(data.battery)
            : null;


    if (level !== null) {

        $("otherBatteryText").textContent =
            `${level}%`;

        $("otherBatteryFill").style.width =
            `${Math.max(
                0,
                Math.min(
                    100,
                    level
                )
            )}%`;

    } else {

        $("otherBatteryText").textContent =
            "—";

        $("otherBatteryFill").style.width =
            "0%";

    }


    $("otherCharging").textContent =
        data.charging
            ? "⚡ در حال شارژ"
            : (
                data.online
                    ? "در حال استفاده"
                    : "آفلاین"
            );

}


function setPartnerOffline() {

    $("otherBatteryText").textContent =
        "—";

    $("otherBatteryFill").style.width =
        "0%";

    $("otherCharging").textContent =
        "آفلاین";

    $("chatOnlineStatus").textContent =
        "آفلاین";

}


function updateOnlineStatus() {

    /*
      وضعیت کلی توسط subscribeOtherPresence
      مدیریت می‌شود.
    */

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    try {

        if (currentUser) {

            const presenceRef =
                ref(
                    realtimeDB,
                    `diaries/${diaryId}/presence/${currentUser.uid}`
                );


            await set(
                presenceRef,
                {
                    online: false,
                    name: currentName,
                    updatedAt: Date.now()
                }
            );

        }


        await signOut(auth);


    } catch (error) {

        console.error(
            "Logout:",
            error
        );

    } finally {

        localStorage.removeItem(
            "diary-logged-in"
        );

        currentUser = null;

        currentName = "";

        location.reload();

    }

}


/* =========================================================
   SERVICES
   ========================================================= */

function startServices() {

    subscribeMembers();

    subscribeMessages();

    setupBattery();

    updateStats();

}


/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(
    auth,
    user => {

        currentUser =
            user || null;

    }
);


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupTheme();

        setupNavigation();

        setupChat();


        $("loginBtn")
            ?.addEventListener(
                "click",
                login
            );


        $("logoutBtn")
            ?.addEventListener(
                "click",
                logout
            );


        $("userName")
            ?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter"
                    ) {

                        login();

                    }

                }
            );


        restoreSession();

    }
);
