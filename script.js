/* =========================================================
   FIREBASE IMPORTS
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    getDatabase,
    ref,
    set,
    onValue,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyBvrnbdz69356LOv3LwY-dFlIVZG8zdQ_4",

    authDomain:
        "notebock-d4ec7.firebaseapp.com",

    projectId:
        "notebock-d4ec7",

    storageBucket:
        "notebock-d4ec7.firebasestorage.app",

    messagingSenderId:
        "931492123706",

    appId:
        "1:931492123706:web:8ea75df636cc7118de9103",

    measurementId:
        "G-7VWTN1D47C",

    databaseURL:
        "https://notebock-d4ec7-default-rtdb.firebaseio.com/"

};


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const firebaseApp =
    initializeApp(firebaseConfig);

const auth =
    getAuth(firebaseApp);

const db =
    getFirestore(firebaseApp);

const realtimeDB =
    getDatabase(firebaseApp);


/* =========================================================
   FIXED DIARY CODE
========================================================= */

/*
   مهم:

   کد داخل input از قبل نوشته نمی‌شود.

   کاربر باید خودش بنویسد:

   asna&amir8890

*/

const CORRECT_DIARY_CODE =
    "asna&amir8890";


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let currentUser = null;

let currentUserName = "";

let diaryCode = "";

let unsubscribeMessages = null;

let unsubscribeMembers = null;

let unsubscribeMyPresence = null;

let unsubscribeOtherPresence = null;

let messages = [];

let members = [];

let otherMember = null;

let selectedMessage = null;

let callTimerInterval = null;

let callSeconds = 0;

let localStream = null;


/* =========================================================
   DOM
========================================================= */

const loginScreen =
    document.getElementById("login");

const appScreen =
    document.getElementById("app");

const enterButton =
    document.getElementById("enter");

const diaryCodeInput =
    document.getElementById("diaryCode");

const userNameInput =
    document.getElementById("userName");

const loginError =
    document.getElementById("loginError");

const currentUserNameElement =
    document.getElementById("currentUserName");

const chatElement =
    document.getElementById("chat");

const messageInput =
    document.getElementById("msg");

const sendButton =
    document.getElementById("send");

const toastElement =
    document.getElementById("toast");

const messageCountElement =
    document.getElementById("messageCount");

const favoriteCountElement =
    document.getElementById("favoriteCount");

const daysCountElement =
    document.getElementById("daysCount");

const myBatteryElement =
    document.getElementById("myBattery");

const myBatteryBarElement =
    document.getElementById("myBatteryBar");

const myBatteryStatusElement =
    document.getElementById("myBatteryStatus");

const otherBatteryElement =
    document.getElementById("otherBattery");

const otherBatteryBarElement =
    document.getElementById("otherBatteryBar");

const otherBatteryStatusElement =
    document.getElementById("otherBatteryStatus");

const chatPartnerStatus =
    document.getElementById("chatPartnerStatus");


/* =========================================================
   INITIAL SETUP
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupNavigation();

        setupQuickChat();

        setupTheme();

        setupLogout();

        setupLogin();

        setupChat();

        setupCallButtons();

    }
);


/* =========================================================
   LOGIN SETUP
========================================================= */

function setupLogin() {

    if (!enterButton) {
        return;
    }


    enterButton.addEventListener(
        "click",
        loginUser
    );


    if (diaryCodeInput) {

        diaryCodeInput.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    loginUser();

                }

            }
        );

    }


    if (userNameInput) {

        userNameInput.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    loginUser();

                }

            }
        );

    }

}


/* =========================================================
   LOGIN
========================================================= */

async function loginUser() {

    const enteredCode =
        diaryCodeInput.value.trim();

    const enteredName =
        userNameInput.value.trim();


    clearLoginError();


    /* -----------------------------------------
       CHECK CODE
    ----------------------------------------- */

    if (!enteredCode) {

        showLoginError(
            "لطفاً کد دفترچه را وارد کنید."
        );

        diaryCodeInput.focus();

        return;

    }


    /*
       کاربر باید خودش کد را وارد کند.
    */

    if (
        enteredCode !==
        CORRECT_DIARY_CODE
    ) {

        showLoginError(
            "کد دفترچه اشتباه است."
        );

        diaryCodeInput.focus();

        return;

    }


    /* -----------------------------------------
       CHECK NAME
    ----------------------------------------- */

    if (!enteredName) {

        showLoginError(
            "لطفاً نام خود را وارد کنید."
        );

        userNameInput.focus();

        return;

    }


    diaryCode =
        enteredCode;

    currentUserName =
        enteredName;


    enterButton.disabled =
        true;


    enterButton.innerHTML =
        `
        <span>
            در حال ورود...
        </span>
        `;


    try {

        /*
           Anonymous Authentication
        */

        if (!auth.currentUser) {

            await signInAnonymously(auth);

        }


        currentUser =
            auth.currentUser;


        await connectToDiary();


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );


        showLoginError(
            getFirebaseErrorMessage(error)
        );


        enterButton.disabled =
            false;


        enterButton.innerHTML =
            `
            <span>
                ورود به دفترچه
            </span>

            <span class="button-arrow">
                ←
            </span>
            `;

    }

}


/* =========================================================
   FIREBASE AUTH STATE
========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            return;

        }


        currentUser =
            user;

    }
);


/* =========================================================
   CONNECT TO DIARY
========================================================= */

async function connectToDiary() {

    if (!currentUser) {

        throw new Error(
            "کاربر وارد نشده است."
        );

    }


    const memberReference =
        doc(
            db,
            "diaries",
            diaryCode,
            "members",
            currentUser.uid
        );


    /*
       اول بررسی می‌کنیم آیا این کاربر
       قبلاً عضو دفترچه بوده یا نه.
    */

    const memberSnapshot =
        await getDoc(
            memberReference
        );


    if (memberSnapshot.exists()) {

        /*
           کاربر قبلاً عضو بوده.
        */

        await updateDoc(
            memberReference,
            {
                name:
                    currentUserName,

                lastSeen:
                    serverTimestamp()
            }
        );

    } else {

        /*
           کاربر جدید است.
        */

        await setDoc(
            memberReference,
            {
                uid:
                    currentUser.uid,

                name:
                    currentUserName,

                createdAt:
                    serverTimestamp(),

                lastSeen:
                    serverTimestamp()
            }
        );

    }


    /*
       بعد از موفقیت،
       برنامه را نمایش می‌دهیم.
    */

    showApplication();


    /*
       شروع Sync
    */

    startMembersListener();

    startMessagesListener();

    startPresence();

    startBattery();

}


/* =========================================================
   SHOW APPLICATION
========================================================= */

function showApplication() {

    if (loginScreen) {

        loginScreen.style.display =
            "none";

    }


    if (appScreen) {

        appScreen.hidden =
            false;

        appScreen.style.display =
            "block";

    }


    if (currentUserNameElement) {

        currentUserNameElement.textContent =
            currentUserName;

    }


    showPage(
        "homePage"
    );


    showToast(
        "با موفقیت وارد دفترچه شدید ❤️"
    );

}


/* =========================================================
   MEMBERS LISTENER
========================================================= */

function startMembersListener() {

    if (unsubscribeMembers) {

        unsubscribeMembers();

    }


    const membersReference =
        collection(
            db,
            "diaries",
            diaryCode,
            "members"
        );


    unsubscribeMembers =
        onSnapshot(
            membersReference,
            snapshot => {

                members =
                    snapshot.docs.map(
                        item => ({
                            id:
                                item.id,

                            ...item.data()
                        })
                    );


                otherMember =
                    members.find(
                        member =>
                            member.uid !==
                            currentUser.uid
                    ) || null;


                updatePartnerStatus();


                if (otherMember) {

                    subscribeOtherPresence();

                }

            },
            error => {

                console.error(
                    "MEMBERS ERROR:",
                    error
                );

            }
        );

}


/* =========================================================
   MESSAGES LISTENER
========================================================= */

function startMessagesListener() {

    if (unsubscribeMessages) {

        unsubscribeMessages();

    }


    const messagesReference =
        collection(
            db,
            "diaries",
            diaryCode,
            "messages"
        );


    const messagesQuery =
        query(
            messagesReference,
            orderBy(
                "createdAt",
                "asc"
            )
        );


    unsubscribeMessages =
        onSnapshot(
            messagesQuery,
            snapshot => {

                messages =
                    snapshot.docs.map(
                        item => ({
                            id:
                                item.id,

                            ...item.data()
                        })
                    );


                renderMessages();

                updateStats();

            },
            error => {

                console.error(
                    "MESSAGES ERROR:",
                    error
                );

            }
        );

}


/* =========================================================
   CHAT SETUP
========================================================= */

function setupChat() {

    if (!sendButton || !messageInput) {

        return;

    }


    sendButton.addEventListener(
        "click",
        sendMessage
    );


    messageInput.addEventListener(
        "keydown",
        event => {

            /*
               Enter = ارسال

               Shift + Enter =
               خط جدید
            */

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );


    /*
       ارتفاع textarea
       به صورت خودکار زیاد شود.
    */

    messageInput.addEventListener(
        "input",
        autoResizeTextarea
    );

}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

    if (!currentUser) {

        showToast(
            "ابتدا وارد دفترچه شوید."
        );

        return;

    }


    const text =
        messageInput.value.trim();


    if (!text) {

        return;

    }


    sendButton.disabled =
        true;


    try {

        await addDoc(
            collection(
                db,
                "diaries",
                diaryCode,
                "messages"
            ),
            {

                senderUid:
                    currentUser.uid,

                senderName:
                    currentUserName,

                text:
                    text,

                createdAt:
                    serverTimestamp(),

                clientCreatedAt:
                    Date.now(),

                edited:
                    false

            }
        );


        /*
           بعد از ارسال،
           کادر کاملاً خالی می‌شود.
        */

        messageInput.value = "";

        autoResizeTextarea();

        messageInput.focus();


    } catch (error) {

        console.error(
            "SEND MESSAGE ERROR:",
            error
        );


        showToast(
            "ارسال پیام انجام نشد."
        );

    }


    sendButton.disabled =
        false;

}


/* =========================================================
   RENDER MESSAGES
========================================================= */

function renderMessages() {

    if (!chatElement) {

        return;

    }


    chatElement.innerHTML =
        "";


    const hiddenMessages =
        getDeletedForMe();


    const visibleMessages =
        messages.filter(
            message =>
                !hiddenMessages.includes(
                    message.id
                )
        );


    if (
        visibleMessages.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "empty-chat";


        empty.innerHTML =
            `
            <div>
                💬
            </div>

            <strong>
                هنوز پیامی نیست
            </strong>

            <span>
                اولین پیام را بفرست ❤️
            </span>
            `;


        chatElement.appendChild(
            empty
        );


        return;

    }


    visibleMessages.forEach(
        message => {

            const mine =
                currentUser &&
                message.senderUid ===
                currentUser.uid;


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                mine
                    ? "message-row mine"
                    : "message-row other";


            const bubble =
                document.createElement(
                    "div"
                );


            bubble.className =
                mine
                    ? "message-bubble mine"
                    : "message-bubble other";


            const text =
                document.createElement(
                    "div"
                );


            text.className =
                "message-text";


            /*
               textContent استفاده شده
               تا HTML از پیام اجرا نشود.
            */

            text.textContent =
                message.text || "";


            bubble.appendChild(
                text
            );


            if (message.edited) {

                const edited =
                    document.createElement(
                        "span"
                    );


                edited.className =
                    "message-edited";


                edited.textContent =
                    "ویرایش‌شده";


                bubble.appendChild(
                    edited
                );

            }


            const time =
                document.createElement(
                    "div"
                );


            time.className =
                "message-time";


            time.textContent =
                getMessageTime(
                    message
                );


            bubble.appendChild(
                time
            );


            row.appendChild(
                bubble
            );


            /*
               کلیک راست روی دسکتاپ
            */

            row.addEventListener(
                "contextmenu",
                event => {

                    event.preventDefault();

                    openMessageMenu(
                        message
                    );

                }
            );


            /*
               نگه داشتن انگشت روی موبایل
            */

            addLongPress(
                row,
                message
            );


            chatElement.appendChild(
                row
            );

        }
    );


    /*
       اسکرول به آخرین پیام
    */

    requestAnimationFrame(
        () => {

            chatElement.scrollTop =
                chatElement.scrollHeight;

        }
    );

}


/* =========================================================
   MESSAGE TIME
========================================================= */

function getMessageTime(message) {

    let date = null;


    if (
        message.createdAt &&
        typeof message.createdAt.toDate ===
            "function"
    ) {

        date =
            message.createdAt.toDate();

    }


    if (
        !date &&
        message.clientCreatedAt
    ) {

        date =
            new Date(
                message.clientCreatedAt
            );

    }


    if (!date) {

        return "";

    }


    return date.toLocaleTimeString(
        "fa-IR",
        {
            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    );

}


/* =========================================================
   LONG PRESS
========================================================= */

function addLongPress(
    element,
    message
) {

    let timer = null;


    element.addEventListener(
        "touchstart",
        () => {

            timer =
                setTimeout(
                    () => {

                        openMessageMenu(
                            message
                        );

                    },
                    600
                );

        },
        {
            passive: true
        }
    );


    element.addEventListener(
        "touchend",
        () => {

            clearTimeout(
                timer
            );

        }
    );


    element.addEventListener(
        "touchmove",
        () => {

            clearTimeout(
                timer
            );

        },
        {
            passive: true
        }
    );

}


/* =========================================================
   MESSAGE MENU
========================================================= */

function openMessageMenu(
    message
) {

    selectedMessage =
        message;


    closeExistingMessageMenu();


    const mine =
        currentUser &&
        message.senderUid ===
        currentUser.uid;


    const overlay =
        document.createElement(
            "div"
        );


    overlay.className =
        "message-action-overlay";


    const menu =
        document.createElement(
            "div"
        );


    menu.className =
        "message-action-menu";


    const title =
        document.createElement(
            "div"
        );


    title.className =
        "message-action-title";


    title.textContent =
        "مدیریت پیام";


    menu.appendChild(
        title
    );


    const buttons =
        document.createElement(
            "div"
        );


    buttons.className =
        "message-action-buttons";


    /*
       کپی
    */

    buttons.appendChild(
        createActionButton(
            "📋 کپی پیام",
            "copy",
            () => {

                copyMessage(
                    message
                );

                closeExistingMessageMenu();

            }
        )
    );


    /*
       اگر پیام مال خودمان است
    */

    if (mine) {

        buttons.appendChild(
            createActionButton(
                "✏️ ویرایش پیام",
                "edit",
                () => {

                    closeExistingMessageMenu();

                    openEditMessage(
                        message
                    );

                }
            )
        );


        /*
           حذف برای خودم
        */

        buttons.appendChild(
            createActionButton(
                "🗑 حذف برای من",
                "warning",
                () => {

                    deleteForMe(
                        message.id
                    );

                    closeExistingMessageMenu();

                }
            )
        );


        /*
           حذف برای هر دو نفر
        */

        buttons.appendChild(
            createActionButton(
                "🗑 حذف برای هر دو نفر",
                "danger",
                async () => {

                    closeExistingMessageMenu();

                    await deleteForEveryone(
                        message
                    );

                }
            )
        );

    } else {

        /*
           پیام طرف مقابل
        */

        buttons.appendChild(
            createActionButton(
                "🗑 حذف برای من",
                "warning",
                () => {

                    deleteForMe(
                        message.id
                    );

                    closeExistingMessageMenu();

                }
            )
        );

    }


    /*
       بستن
    */

    buttons.appendChild(
        createActionButton(
            "بستن",
            "copy",
            () => {

                closeExistingMessageMenu();

            }
        )
    );


    menu.appendChild(
        buttons
    );


    overlay.appendChild(
        menu
    );


    document.body.appendChild(
        overlay
    );


    /*
       کلیک بیرون منو
    */

    overlay.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                overlay
            ) {

                closeExistingMessageMenu();

            }

        }
    );


    requestAnimationFrame(
        () => {

            overlay.classList.add(
                "show"
            );

        }
    );

}


/* =========================================================
   CREATE ACTION BUTTON
========================================================= */

function createActionButton(
    text,
    type,
    callback
) {

    const button =
        document.createElement(
            "button"
        );


    button.type =
        "button";


    button.className =
        `message-action-button ${type}`;


    button.textContent =
        text;


    button.addEventListener(
        "click",
        callback
    );


    return button;

}


/* =========================================================
   CLOSE MESSAGE MENU
========================================================= */

function closeExistingMessageMenu() {

    const old =
        document.querySelector(
            ".message-action-overlay"
        );


    if (old) {

        old.remove();

    }


    selectedMessage =
        null;

}


/* =========================================================
   COPY MESSAGE
========================================================= */

async function copyMessage(
    message
) {

    try {

        await navigator.clipboard.writeText(
            message.text || ""
        );


        showToast(
            "پیام کپی شد 📋"
        );


    } catch (error) {

        console.error(error);

        showToast(
            "کپی پیام انجام نشد."
        );

    }

}


/* =========================================================
   DELETE FOR ME
========================================================= */

function deleteForMe(
    messageId
) {

    const deleted =
        getDeletedForMe();


    if (
        !deleted.includes(
            messageId
        )
    ) {

        deleted.push(
            messageId
        );

    }


    localStorage.setItem(
        getDeletedStorageKey(),
        JSON.stringify(
            deleted
        )
    );


    renderMessages();

    showToast(
        "پیام برای شما حذف شد."
    );

}


/* =========================================================
   GET DELETED MESSAGES
========================================================= */

function getDeletedForMe() {

    try {

        const data =
            localStorage.getItem(
                getDeletedStorageKey()
            );


        return data
            ? JSON.parse(data)
            : [];

    } catch {

        return [];

    }

}


/* =========================================================
   DELETED STORAGE KEY
========================================================= */

function getDeletedStorageKey() {

    const uid =
        currentUser
            ? currentUser.uid
            : "unknown";


    return `
        sharedDiaryDeletedMessages_
        ${diaryCode}_
        ${uid}
    `.replace(
        /\s/g,
        ""
    );

}


/* =========================================================
   DELETE FOR EVERYONE
========================================================= */

async function deleteForEveryone(
    message
) {

    if (!currentUser) {

        return;

    }


    if (
        message.senderUid !==
        currentUser.uid
    ) {

        showToast(
            "فقط صاحب پیام می‌تواند آن را برای هر دو نفر حذف کند."
        );

        return;

    }


    try {

        await deleteDoc(
            doc(
                db,
                "diaries",
                diaryCode,
                "messages",
                message.id
            )
        );


        showToast(
            "پیام برای هر دو نفر حذف شد."
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "حذف پیام انجام نشد."
        );

    }

}


/* =========================================================
   EDIT MESSAGE
========================================================= */

function openEditMessage(
    message
) {

    if (!currentUser) {

        return;

    }


    if (
        message.senderUid !==
        currentUser.uid
    ) {

        return;

    }


    const overlay =
        document.createElement(
            "div"
        );


    overlay.className =
        "modal-overlay";


    const modal =
        document.createElement(
            "div"
        );


    modal.className =
        "modal-card";


    modal.innerHTML =
        `
        <h3>
            ویرایش پیام
        </h3>

        <textarea
            class="edit-message-input"
        ></textarea>

        <div class="modal-actions">

            <button
                type="button"
                class="modal-cancel"
            >
                انصراف
            </button>

            <button
                type="button"
                class="modal-confirm"
            >
                ذخیره
            </button>

        </div>
        `;


    const input =
        modal.querySelector(
            ".edit-message-input"
        );


    const cancel =
        modal.querySelector(
            ".modal-cancel"
        );


    const confirm =
        modal.querySelector(
            ".modal-confirm"
        );


    input.value =
        message.text || "";


    overlay.appendChild(
        modal
    );


    document.body.appendChild(
        overlay
    );


    input.focus();


    cancel.addEventListener(
        "click",
        () => {

            overlay.remove();

        }
    );


    confirm.addEventListener(
        "click",
        async () => {

            const newText =
                input.value.trim();


            if (!newText) {

                showToast(
                    "پیام نمی‌تواند خالی باشد."
                );

                return;

            }


            confirm.disabled =
                true;


            try {

                await updateDoc(
                    doc(
                        db,
                        "diaries",
                        diaryCode,
                        "messages",
                        message.id
                    ),
                    {
                        text:
                            newText,

                        edited:
                            true
                    }
                );


                overlay.remove();


                showToast(
                    "پیام ویرایش شد ✏️"
                );


            } catch (error) {

                console.error(
                    error
                );


                confirm.disabled =
                    false;


                showToast(
                    "ویرایش پیام انجام نشد."
                );

            }

        }
    );

}


/* =========================================================
   AUTO RESIZE TEXTAREA
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
            130
        ) + "px";

}


/* =========================================================
   UPDATE STATS
========================================================= */

function updateStats() {

    if (messageCountElement) {

        messageCountElement.textContent =
            messages.length.toLocaleString(
                "fa-IR"
            );

    }


    /*
       فعلاً تعداد Favorite را
       از پیام‌های دارای favorite می‌گیریم.
    */

    const favoriteCount =
        messages.filter(
            message =>
                message.favorite === true
        ).length;


    if (favoriteCountElement) {

        favoriteCountElement.textContent =
            favoriteCount.toLocaleString(
                "fa-IR"
            );

    }


    /*
       تعداد روزهای دارای پیام
    */

    const uniqueDays =
        new Set();


    messages.forEach(
        message => {

            let date = null;


            if (
                message.createdAt &&
                typeof message.createdAt.toDate ===
                    "function"
            ) {

                date =
                    message.createdAt.toDate();

            } else if (
                message.clientCreatedAt
            ) {

                date =
                    new Date(
                        message.clientCreatedAt
                    );

            }


            if (date) {

                uniqueDays.add(
                    date.toISOString().slice(
                        0,
                        10
                    )
                );

            }

        }
    );


    if (daysCountElement) {

        daysCountElement.textContent =
            uniqueDays.size.toLocaleString(
                "fa-IR"
            );

    }

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );


    navItems.forEach(
        item => {

            item.addEventListener(
                "click",
                () => {

                    const page =
                        item.dataset.page;


                    if (!page) {

                        return;

                    }


                    showPage(
                        page
                    );

                }
            );

        }
    );

}


/* =========================================================
   SHOW PAGE
========================================================= */

function showPage(
    pageId
) {

    const pages =
        document.querySelectorAll(
            ".page"
        );


    pages.forEach(
        page => {

            page.hidden =
                page.id !==
                pageId;

        }
    );


    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );


    navItems.forEach(
        item => {

            item.classList.toggle(
                "active",
                item.dataset.page ===
                pageId
            );

        }
    );


    window.scrollTo(
        {
            top: 0,
            behavior: "smooth"
        }
    );

}


/* =========================================================
   QUICK CHAT
========================================================= */

function setupQuickChat() {

    const buttons =
        document.querySelectorAll(
            "[data-open-page]"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    showPage(
                        button.dataset.openPage
                    );

                }
            );

        }
    );

}


/* =========================================================
   THEME
========================================================= */

function setupTheme() {

    const themeButton =
        document.getElementById(
            "themeToggle"
        );


    const savedTheme =
        localStorage.getItem(
            "sharedDiaryTheme"
        );


    if (
        savedTheme ===
        "dark"
    ) {

        document.body.classList.add(
            "dark"
        );

    }


    updateThemeButton();


    if (themeButton) {

        themeButton.addEventListener(
            "click",
            () => {

                document.body.classList.toggle(
                    "dark"
                );


                const dark =
                    document.body.classList.contains(
                        "dark"
                    );


                localStorage.setItem(
                    "sharedDiaryTheme",
                    dark
                        ? "dark"
                        : "light"
                );


                updateThemeButton();

            }
        );

    }

}


/* =========================================================
   UPDATE THEME BUTTON
========================================================= */

function updateThemeButton() {

    const button =
        document.getElementById(
            "themeToggle"
        );


    if (!button) {

        return;

    }


    const dark =
        document.body.classList.contains(
            "dark"
        );


    button.textContent =
        dark
            ? "☀️"
            : "🌙";

}


/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {

    const button =
        document.getElementById(
            "logoutBtn"
        );


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        async () => {

            try {

                if (unsubscribeMessages) {

                    unsubscribeMessages();

                }


                if (unsubscribeMembers) {

                    unsubscribeMembers();

                }


                if (unsubscribeMyPresence) {

                    unsubscribeMyPresence();

                }


                if (unsubscribeOtherPresence) {

                    unsubscribeOtherPresence();

                }


                await signOut(
                    auth
                );


            } catch (error) {

                console.error(
                    error
                );

            }


            location.reload();

        }
    );

}


/* =========================================================
   PRESENCE
========================================================= */

function startPresence() {

    if (!currentUser || !diaryCode) {

        return;

    }


    const presenceReference =
        ref(
            realtimeDB,
            `diaries/${encodeURIComponent(diaryCode)}/presence/${currentUser.uid}`
        );


    set(
        presenceReference,
        {
            online:
                true,

            name:
                currentUserName,

            updatedAt:
                Date.now()
        }
    ).catch(
        error => {

            console.error(
                "PRESENCE SET ERROR:",
                error
            );

        }
    );


    onDisconnect(
        presenceReference
    ).set(
        {
            online:
                false,

            name:
                currentUserName,

            updatedAt:
                Date.now()
        }
    );


    /*
       وضعیت خودمان
    */

    unsubscribeMyPresence =
        onValue(
            presenceReference,
            snapshot => {

                const data =
                    snapshot.val();


                if (!data) {

                    return;

                }

            }
        );

}


/* =========================================================
   OTHER USER PRESENCE
========================================================= */

function subscribeOtherPresence() {

    if (
        !otherMember ||
        !diaryCode
    ) {

        return;

    }


    if (unsubscribeOtherPresence) {

        unsubscribeOtherPresence();

    }


    const reference =
        ref(
            realtimeDB,
            `diaries/${encodeURIComponent(diaryCode)}/presence/${otherMember.uid}`
        );


    unsubscribeOtherPresence =
        onValue(
            reference,
            snapshot => {

                const data =
                    snapshot.val();


                if (
                    data &&
                    data.online
                ) {

                    if (chatPartnerStatus) {

                        chatPartnerStatus.textContent =
                            "آنلاین 🟢";

                    }

                } else {

                    if (chatPartnerStatus) {

                        chatPartnerStatus.textContent =
                            "آفلاین";

                    }

                }

            },
            error => {

                console.error(
                    "OTHER PRESENCE ERROR:",
                    error
                );

            }
        );

}


/* =========================================================
   PARTNER STATUS
========================================================= */

function updatePartnerStatus() {

    if (!chatPartnerStatus) {

        return;

    }


    if (otherMember) {

        chatPartnerStatus.textContent =
            otherMember.name ||
            "نفر دیگر";

    } else {

        chatPartnerStatus.textContent =
            "منتظر نفر دیگر...";

    }

}


/* =========================================================
   BATTERY
========================================================= */

async function startBattery() {

    if (!currentUser) {

        return;

    }


    /*
       مرورگرهایی که Battery API دارند
    */

    if (
        "getBattery" in navigator
    ) {

        try {

            const battery =
                await navigator.getBattery();


            updateMyBattery(
                battery
            );


            battery.addEventListener(
                "levelchange",
                () => {

                    updateMyBattery(
                        battery
                    );

                }
            );


            battery.addEventListener(
                "chargingchange",
                () => {

                    updateMyBattery(
                        battery
                    );

                }
            );


            /*
               ارسال باتری به Realtime Database
            */

            const batteryReference =
                ref(
                    realtimeDB,
                    `diaries/${encodeURIComponent(diaryCode)}/battery/${currentUser.uid}`
                );


            const syncBattery =
                () => {

                    set(
                        batteryReference,
                        {
                            level:
                                Math.round(
                                    battery.level *
                                    100
                                ),

                            charging:
                                battery.charging,

                            updatedAt:
                                Date.now()
                        }
                    ).catch(
                        error => {

                            console.error(
                                "BATTERY SYNC ERROR:",
                                error
                            );

                        }
                    );

                };


            syncBattery();


            battery.addEventListener(
                "levelchange",
                syncBattery
            );


            battery.addEventListener(
                "chargingchange",
                syncBattery
            );


        } catch (error) {

            console.error(
                "BATTERY ERROR:",
                error
            );


            setBatteryUnavailable();

        }

    } else {

        setBatteryUnavailable();

    }


    /*
       باتری نفر دوم
    */

    subscribeOtherBattery();

}


/* =========================================================
   UPDATE MY BATTERY
========================================================= */

function updateMyBattery(
    battery
) {

    const level =
        Math.round(
            battery.level *
            100
        );


    if (myBatteryElement) {

        myBatteryElement.textContent =
            `${level}%`;

    }


    if (myBatteryBarElement) {

        myBatteryBarElement.style.width =
            `${level}%`;

    }


    if (myBatteryStatusElement) {

        myBatteryStatusElement.textContent =
            battery.charging
                ? "در حال شارژ ⚡"
                : "در حال استفاده";

    }

}


/* =========================================================
   BATTERY UNAVAILABLE
========================================================= */

function setBatteryUnavailable() {

    if (myBatteryElement) {

        myBatteryElement.textContent =
            "--%";

    }


    if (myBatteryStatusElement) {

        myBatteryStatusElement.textContent =
            "قابل تشخیص نیست";

    }

}


/* =========================================================
   OTHER BATTERY
========================================================= */

function subscribeOtherBattery() {

    if (
        !otherMember ||
        !diaryCode
    ) {

        return;

    }


    const reference =
        ref(
            realtimeDB,
            `diaries/${encodeURIComponent(diaryCode)}/battery/${otherMember.uid}`
        );


    onValue(
        reference,
        snapshot => {

            const data =
                snapshot.val();


            if (!data) {

                if (otherBatteryElement) {

                    otherBatteryElement.textContent =
                        "--%";

                }


                if (otherBatteryStatusElement) {

                    otherBatteryStatusElement.textContent =
                        "منتظر اطلاعات...";

                }

                return;

            }


            const level =
                Number(
                    data.level || 0
                );


            if (otherBatteryElement) {

                otherBatteryElement.textContent =
                    `${level}%`;

            }


            if (otherBatteryBarElement) {

                otherBatteryBarElement.style.width =
                    `${level}%`;

            }


            if (otherBatteryStatusElement) {

                otherBatteryStatusElement.textContent =
                    data.charging
                        ? "در حال شارژ ⚡"
                        : "در حال استفاده";

            }

        },
        error => {

            console.error(
                "OTHER BATTERY ERROR:",
                error
            );

        }
    );

}


/* =========================================================
   CALL BUTTONS
========================================================= */

function setupCallButtons() {

    const audioButton =
        document.getElementById(
            "audioCallBtn"
        );


    const videoButton =
        document.getElementById(
            "videoCallBtn"
        );


    if (audioButton) {

        audioButton.addEventListener(
            "click",
            () => {

                startCallScreen(
                    "audio"
                );

            }
        );

    }


    if (videoButton) {

        videoButton.addEventListener(
            "click",
            () => {

                startCallScreen(
                    "video"
                );

            }
        );

    }


    const endButton =
        document.getElementById(
            "endCallBtn"
        );


    if (endButton) {

        endButton.addEventListener(
            "click",
            endCallScreen
        );

    }


    const micButton =
        document.getElementById(
            "micBtn"
        );


    if (micButton) {

        micButton.addEventListener(
            "click",
            toggleMicrophone
        );

    }


    const cameraButton =
        document.getElementById(
            "cameraBtn"
        );


    if (cameraButton) {

        cameraButton.addEventListener(
            "click",
            toggleCamera
        );

    }

}


/* =========================================================
   CALL SCREEN
========================================================= */

async function startCallScreen(
    type
) {

    const screen =
        document.getElementById(
            "callScreen"
        );


    if (!screen) {

        return;

    }


    screen.hidden =
        false;


    const title =
        document.getElementById(
            "callTitle"
        );


    const status =
        document.getElementById(
            "callStatus"
        );


    if (title) {

        title.textContent =
            type === "video"
                ? "تماس تصویری"
                : "تماس صوتی";

    }


    if (status) {

        status.textContent =
            "در حال برقراری تماس...";

    }


    resetCallTimer();

    startCallTimer();


    /*
       میکروفون / دوربین
       در صورت اجازه مرورگر
    */

    try {

        localStream =
            await navigator.mediaDevices.getUserMedia(
                {
                    audio:
                        true,

                    video:
                        type === "video"
                }
            );


        const localVideo =
            document.getElementById(
                "localVideo"
            );


        if (
            localVideo &&
            type === "video"
        ) {

            localVideo.srcObject =
                localStream;

            localVideo.style.display =
                "block";

        }


        if (status) {

            status.textContent =
                "تماس برقرار شد";

        }

    } catch (error) {

        console.error(
            "MEDIA ERROR:",
            error
        );


        if (status) {

            status.textContent =
                "دسترسی به میکروفون یا دوربین داده نشد";

        }

    }

}


/* =========================================================
   CALL TIMER
========================================================= */

function startCallTimer() {

    callSeconds =
        0;


    clearInterval(
        callTimerInterval
    );


    callTimerInterval =
        setInterval(
            () => {

                callSeconds++;

                updateCallTimer();

            },
            1000
        );

}


/* =========================================================
   RESET CALL TIMER
========================================================= */

function resetCallTimer() {

    clearInterval(
        callTimerInterval
    );


    callSeconds =
        0;


    updateCallTimer();

}


/* =========================================================
   UPDATE CALL TIMER
========================================================= */

function updateCallTimer() {

    const timer =
        document.getElementById(
            "callTimer"
        );


    if (!timer) {

        return;

    }


    const minutes =
        Math.floor(
            callSeconds / 60
        )
            .toString()
            .padStart(
                2,
                "0"
            );


    const seconds =
        (
            callSeconds % 60
        )
            .toString()
            .padStart(
                2,
                "0"
            );


    timer.textContent =
        `${minutes}:${seconds}`;

}


/* =========================================================
   MICROPHONE
========================================================= */

function toggleMicrophone() {

    if (!localStream) {

        return;

    }


    const tracks =
        localStream.getAudioTracks();


    if (!tracks.length) {

        return;

    }


    tracks.forEach(
        track => {

            track.enabled =
                !track.enabled;

        }
    );


    const button =
        document.getElementById(
            "micBtn"
        );


    if (button) {

        button.textContent =
            tracks[0].enabled
                ? "🎤"
                : "🔇";

    }

}


/* =========================================================
   CAMERA
========================================================= */

function toggleCamera() {

    if (!localStream) {

        return;

    }


    const tracks =
        localStream.getVideoTracks();


    if (!tracks.length) {

        showToast(
            "این تماس دوربین ندارد."
        );

        return;

    }


    tracks.forEach(
        track => {

            track.enabled =
                !track.enabled;

        }
    );


    const button =
        document.getElementById(
            "cameraBtn"
        );


    if (button) {

        button.textContent =
            tracks[0].enabled
                ? "📹"
                : "🚫";

    }

}


/* =========================================================
   END CALL
========================================================= */

function endCallScreen() {

    clearInterval(
        callTimerInterval
    );


    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => {

                    track.stop();

                }
            );

        localStream =
            null;

    }


    const localVideo =
        document.getElementById(
            "localVideo"
        );


    if (localVideo) {

        localVideo.srcObject =
            null;

        localVideo.style.display =
            "none";

    }


    const remoteVideo =
        document.getElementById(
            "remoteVideo"
        );


    if (remoteVideo) {

        remoteVideo.srcObject =
            null;

    }


    const screen =
        document.getElementById(
            "callScreen"
        );


    if (screen) {

        screen.hidden =
            true;

    }


    resetCallTimer();

}


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;


function showToast(
    message
) {

    if (!toastElement) {

        return;

    }


    toastElement.textContent =
        message;


    toastElement.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toastElement.classList.remove(
                    "show"
                );

            },
            2500
        );

}


/* =========================================================
   LOGIN ERROR
========================================================= */

function showLoginError(
    message
) {

    if (!loginError) {

        return;

    }


    loginError.textContent =
        message;

}


/* =========================================================
   CLEAR LOGIN ERROR
========================================================= */

function clearLoginError() {

    if (loginError) {

        loginError.textContent =
            "";

    }

}


/* =========================================================
   FIREBASE ERROR MESSAGE
========================================================= */

function getFirebaseErrorMessage(
    error
) {

    const code =
        error?.code || "";


    if (
        code.includes(
            "auth/network-request-failed"
        )
    ) {

        return "اتصال اینترنت را بررسی کنید.";

    }


    if (
        code.includes(
            "permission-denied"
        )
    ) {

        return "دسترسی Firebase رد شد. قوانین Firebase را بررسی کنید.";

    }


    if (
        code.includes(
            "unauthorized"
        )
    ) {

        return "دسترسی به دفترچه امکان‌پذیر نیست.";

    }


    return "ورود انجام نشد. دوباره تلاش کنید.";

}


/* =========================================================
   PAGE VISIBILITY HELPER
========================================================= */

function isLoggedIn() {

    return !!currentUser;

}


/* =========================================================
   PREVENT EMPTY SUBMIT
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (
            currentUser &&
            diaryCode
        ) {

            const reference =
                ref(
                    realtimeDB,
                    `diaries/${encodeURIComponent(diaryCode)}/presence/${currentUser.uid}`
                );


            set(
                reference,
                {
                    online:
                        false,

                    name:
                        currentUserName,

                    updatedAt:
                        Date.now()
                }
            ).catch(
                () => {}
            );

        }

    }
);
