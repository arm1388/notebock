/* =========================================================
   SHARED DIARY — script.js
   ========================================================= */

/* =========================
   Firebase
========================= */

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
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getDatabase,
  ref,
  set,
  update,
  onValue,
  onDisconnect,
  serverTimestamp as rtdbServerTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";


/* =========================================================
   CONFIG
========================================================= */

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

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const realtimeDB = getDatabase(app);


/* =========================================================
   ثابت اصلی دفترچه
   در رابط کاربری نمایش داده نمی‌شود
========================================================= */

const FIXED_DIARY_CODE = "asna&amir8890";

let diaryId = FIXED_DIARY_CODE;

let currentUser = null;
let currentUserName = "";
let otherMember = null;

let unsubscribeMembers = null;
let unsubscribeMessages = null;
let unsubscribeOtherPresence = null;
let unsubscribeOtherBattery = null;

let allMessages = [];

let selectedMessage = null;

let localHiddenMessages = JSON.parse(
  localStorage.getItem(
    `hiddenMessages_${FIXED_DIARY_CODE}`
  ) || "[]"
);


/* =========================================================
   DOM Helpers
========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [
  ...document.querySelectorAll(selector)
];


function getElement(...selectors) {

  for (const selector of selectors) {

    const element = $(selector);

    if (element) {
      return element;
    }

  }

  return null;
}


/* =========================================================
   Toast
========================================================= */

function showToast(message, type = "normal") {

  let toast = $(".toast");

  if (!toast) {

    toast = document.createElement("div");

    toast.className = "toast";

    document.body.appendChild(toast);
  }

  toast.textContent = message;

  toast.classList.remove("show");

  if (type === "success") {
    toast.classList.add("success");
  }

  if (type === "error") {
    toast.classList.add("error");
  }

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}


/* =========================================================
   Theme
========================================================= */

function setupTheme() {

  const themeButton = getElement(
    "#themeToggle",
    "#themeBtn",
    ".theme-toggle"
  );

  const savedTheme =
    localStorage.getItem("diaryTheme") || "light";

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  }

  if (!themeButton) return;

  themeButton.addEventListener("click", () => {

    document.body.classList.toggle("dark");

    const dark =
      document.body.classList.contains("dark");

    localStorage.setItem(
      "diaryTheme",
      dark ? "dark" : "light"
    );

  });
}


/* =========================================================
   Navigation
========================================================= */

function setupNavigation() {

  const buttons = $$(
    "[data-page], [data-nav], .nav-item"
  );

  buttons.forEach(button => {

    button.addEventListener("click", () => {

      const target =
        button.dataset.page ||
        button.dataset.nav ||
        button.getAttribute("href");

      if (!target) return;

      buttons.forEach(btn =>
        btn.classList.remove("active")
      );

      button.classList.add("active");

      const pages = $$(".page, .section");

      pages.forEach(page => {

        page.classList.remove("active");

        const id =
          page.id ||
          page.dataset.page;

        if (
          id === target ||
          `#${id}` === target
        ) {
          page.classList.add("active");
        }

      });

    });

  });
}


/* =========================================================
   Login
========================================================= */

function setupLogin() {

  const loginBtn = getElement(
    "#loginBtn",
    "#enterBtn",
    ".login-btn"
  );

  const nameInput = getElement(
    "#userName",
    "#nameInput",
    "#username"
  );

  const diaryInput = getElement(
    "#diaryCode",
    "#codeInput"
  );

  /*
    اگر نسخه قبلی HTML هنوز فیلد کد دارد،
    آن را از رابط کاربری مخفی می‌کنیم.
  */

  if (diaryInput) {

    diaryInput.value = FIXED_DIARY_CODE;

    diaryInput.style.display = "none";

    const parent = diaryInput.parentElement;

    if (parent) {

      const label = parent.querySelector("label");

      if (label) {
        label.style.display = "none";
      }

    }
  }


  if (!loginBtn) return;


  loginBtn.addEventListener("click", async () => {

    const name =
      nameInput?.value.trim();

    if (!name) {

      showToast(
        "لطفاً نام خودت را وارد کن",
        "error"
      );

      return;
    }


    currentUserName = name;

    loginBtn.disabled = true;

    loginBtn.classList.add("loading");


    try {

      await signInAnonymously(auth);

    } catch (error) {

      console.error(error);

      showToast(
        "ورود انجام نشد. اتصال اینترنت را بررسی کن.",
        "error"
      );

      loginBtn.disabled = false;

      loginBtn.classList.remove("loading");
    }

  });

}


/* =========================================================
   Auth
========================================================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  currentUser = user;

  /*
    نام را از localStorage می‌گیریم
  */

  const savedName =
    localStorage.getItem(
      `diaryName_${user.uid}`
    );

  if (!currentUserName && savedName) {
    currentUserName = savedName;
  }

  /*
    اگر نام نداریم، از input بگیریم
  */

  if (!currentUserName) {

    const nameInput = getElement(
      "#userName",
      "#nameInput",
      "#username"
    );

    if (nameInput) {
      currentUserName =
        nameInput.value.trim();
    }
  }


  if (!currentUserName) {

    showLoginScreen();

    return;
  }


  try {

    await connectToDiary();

  } catch (error) {

    console.error(error);

    showToast(
      "ورود به دفترچه انجام نشد.",
      "error"
    );

  }

});


/* =========================================================
   Connect Diary
========================================================= */

async function connectToDiary() {

  const membersRef =
    collection(
      db,
      "diaries",
      diaryId,
      "members"
    );


  const memberSnapshot =
    await getDocs(membersRef);


  const existingMember =
    memberSnapshot.docs.find(
      item => item.id === currentUser.uid
    );


  /*
    اگر کاربر قبلاً عضو بوده
  */

  if (existingMember) {

    await updateDoc(
      doc(
        db,
        "diaries",
        diaryId,
        "members",
        currentUser.uid
      ),
      {
        name: currentUserName,
        lastSeen: serverTimestamp()
      }
    );

  }

  /*
    اگر کاربر عضو نیست
  */

  else {

    /*
      فقط دو نفر اجازه ورود دارند.
    */

    if (memberSnapshot.size >= 2) {

      showToast(
        "این دفترچه قبلاً دو عضو دارد.",
        "error"
      );

      await signOut(auth);

      return;
    }


    await setDoc(
      doc(
        db,
        "diaries",
        diaryId,
        "members",
        currentUser.uid
      ),
      {
        uid: currentUser.uid,
        name: currentUserName,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      }
    );

  }


  localStorage.setItem(
    `diaryName_${currentUser.uid}`,
    currentUserName
  );


  showDashboard();

  setupEverything();

}


/* =========================================================
   Screen
========================================================= */

function showLoginScreen() {

  const login =
    getElement(
      "#loginScreen",
      ".login-screen"
    );

  const appScreen =
    getElement(
      "#appScreen",
      ".app-screen"
    );

  if (login) {
    login.style.display = "";
  }

  if (appScreen) {
    appScreen.style.display = "none";
  }

}


function showDashboard() {

  const login =
    getElement(
      "#loginScreen",
      ".login-screen"
    );

  const appScreen =
    getElement(
      "#appScreen",
      ".app-screen"
    );

  if (login) {
    login.style.display = "none";
  }

  if (appScreen) {
    appScreen.style.display = "";
  }

}


/* =========================================================
   Setup Everything
========================================================= */

let everythingInitialized = false;

function setupEverything() {

  if (everythingInitialized) return;

  everythingInitialized = true;

  setupNavigation();

  setupTheme();

  setupMembers();

  setupChat();

  setupPresence();

  setupBattery();

  setupCalls();

  updateUserNameUI();

}


/* =========================================================
   Members
========================================================= */

function setupMembers() {

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

        const members =
          snapshot.docs.map(
            item => ({
              id: item.id,
              ...item.data()
            })
          );


        const me =
          members.find(
            member =>
              member.uid === currentUser.uid
          );


        otherMember =
          members.find(
            member =>
              member.uid !== currentUser.uid
          ) || null;


        if (me?.name) {

          currentUserName =
            me.name;

          updateUserNameUI();
        }


        updatePartnerUI();


        /*
          این بخش مهم است:
          بعد از اینکه طرف مقابل پیدا شد،
          Presence و Battery را وصل می‌کنیم.
        */

        subscribeOtherPresence();

        subscribeOtherBattery();

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
   User UI
========================================================= */

function updateUserNameUI() {

  $$(
    "[data-current-user], #currentUserName, .current-user-name"
  ).forEach(element => {

    element.textContent =
      currentUserName || "من";

  });

}


function updatePartnerUI() {

  const name =
    otherMember?.name ||
    "نفر دیگر";


  $$(
    "[data-partner-name], #partnerName, .partner-name"
  ).forEach(element => {

    element.textContent = name;

  });

}


/* =========================================================
   CHAT
========================================================= */

function setupChat() {

  const messagesContainer =
    getElement(
      "#messages",
      "#chatMessages",
      ".messages"
    );

  if (!messagesContainer) return;


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


  /*
    فقط orderBy روی createdAt
    تا Composite Index لازم نشود.
  */

  const messagesQuery =
    query(
      messagesRef,
      orderBy("createdAt", "asc")
    );


  unsubscribeMessages =
    onSnapshot(
      messagesQuery,
      snapshot => {

        allMessages =
          snapshot.docs.map(
            item => ({
              id: item.id,
              ...item.data()
            })
          );


        /*
          مرتب‌سازی مجدد با clientCreatedAt
          برای زمانی که serverTimestamp هنوز pending است.
        */

        allMessages.sort(
          (a, b) => {

            const aTime =
              typeof a.clientCreatedAt === "number"
                ? a.clientCreatedAt
                : 0;

            const bTime =
              typeof b.clientCreatedAt === "number"
                ? b.clientCreatedAt
                : 0;

            return aTime - bTime;

          }
        );


        renderMessages();

        updateStats();

      },
      error => {

        console.error(
          "Messages listener:",
          error
        );

        showToast(
          "دریافت پیام‌ها با مشکل مواجه شد.",
          "error"
        );

      }
    );


  setupMessageInput();

}


/* =========================================================
   Message Input
========================================================= */

function setupMessageInput() {

  const input =
    getElement(
      "#messageInput",
      "#chatInput",
      "textarea[name='message']"
    );


  const sendBtn =
    getElement(
      "#sendMessage",
      "#sendBtn",
      ".send-message"
    );


  if (sendBtn) {

    sendBtn.addEventListener(
      "click",
      sendMessage
    );

  }


  if (input) {

    input.addEventListener(
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

  }

}


/* =========================================================
   Send Message
========================================================= */

async function sendMessage() {

  const input =
    getElement(
      "#messageInput",
      "#chatInput",
      "textarea[name='message']"
    );


  if (!input) return;


  const text =
    input.value.trim();


  if (!text) return;


  if (!currentUser) {

    showToast(
      "ابتدا وارد دفترچه شو.",
      "error"
    );

    return;
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
        senderUid:
          currentUser.uid,

        senderName:
          currentUserName,

        text,

        clientCreatedAt:
          Date.now(),

        createdAt:
          serverTimestamp(),

        edited:
          false
      }
    );


    input.value = "";

    input.focus();

  } catch (error) {

    console.error(error);

    showToast(
      "ارسال پیام انجام نشد.",
      "error"
    );

  }

}


/* =========================================================
   Render Messages
========================================================= */

function renderMessages() {

  const container =
    getElement(
      "#messages",
      "#chatMessages",
      ".messages"
    );


  if (!container) return;


  container.innerHTML = "";


  const visibleMessages =
    allMessages.filter(
      message =>
        !localHiddenMessages.includes(message.id)
    );


  visibleMessages.forEach(
    message => {

      const element =
        createMessageElement(message);

      container.appendChild(element);

    }
  );


  requestAnimationFrame(() => {

    container.scrollTop =
      container.scrollHeight;

  });

}


/* =========================================================
   Create Message
========================================================= */

function createMessageElement(message) {

  const mine =
    message.senderUid === currentUser?.uid;


  const wrapper =
    document.createElement("div");


  wrapper.className =
    `message-row ${mine ? "mine" : "other"}`;


  wrapper.dataset.messageId =
    message.id;


  const bubble =
    document.createElement("div");


  bubble.className =
    `message-bubble ${mine ? "mine" : "other"}`;


  /*
    متن
  */

  const text =
    document.createElement("div");


  text.className =
    "message-text";


  text.textContent =
    message.text || "";


  bubble.appendChild(text);


  /*
    edited
  */

  if (message.edited) {

    const edited =
      document.createElement("span");

    edited.className =
      "message-edited";

    edited.textContent =
      "ویرایش‌شده";

    bubble.appendChild(edited);

  }


  /*
    زمان
  */

  const time =
    document.createElement("div");


  time.className =
    "message-time";


  time.textContent =
    formatMessageTime(message);


  bubble.appendChild(time);


  wrapper.appendChild(bubble);


  /*
    Long Press
  */

  setupMessageActions(
    wrapper,
    message
  );


  return wrapper;

}


/* =========================================================
   Message Time
========================================================= */

function formatMessageTime(message) {

  let timestamp = null;


  if (
    message.createdAt &&
    typeof message.createdAt.toDate === "function"
  ) {

    timestamp =
      message.createdAt.toDate();

  }


  if (!timestamp && message.clientCreatedAt) {

    timestamp =
      new Date(
        message.clientCreatedAt
      );

  }


  if (!timestamp) return "";


  return timestamp.toLocaleTimeString(
    "fa-IR",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


/* =========================================================
   Message Long Press
========================================================= */

function setupMessageActions(
  element,
  message
) {

  let pressTimer = null;

  let longPressed = false;


  const startPress = event => {

    if (
      event.target.closest(
        ".message-action-overlay"
      )
    ) {
      return;
    }


    longPressed = false;


    pressTimer =
      setTimeout(() => {

        longPressed = true;

        openMessageActions(message);

      }, 550);

  };


  const cancelPress = () => {

    if (pressTimer) {

      clearTimeout(
        pressTimer
      );

      pressTimer = null;

    }

  };


  element.addEventListener(
    "touchstart",
    startPress,
    {
      passive: true
    }
  );


  element.addEventListener(
    "touchend",
    cancelPress
  );


  element.addEventListener(
    "touchmove",
    cancelPress
  );


  element.addEventListener(
    "touchcancel",
    cancelPress
  );


  /*
    دسکتاپ
  */

  element.addEventListener(
    "contextmenu",
    event => {

      event.preventDefault();

      openMessageActions(message);

    }
  );

}


/* =========================================================
   Message Action Overlay
========================================================= */

function openMessageActions(message) {

  closeMessageActions();

  selectedMessage =
    message;


  const overlay =
    document.createElement("div");


  overlay.className =
    "message-action-overlay";


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target === overlay
      ) {

        closeMessageActions();

      }

    }
  );


  const menu =
    document.createElement("div");


  menu.className =
    "message-action-menu";


  const title =
    document.createElement("div");


  title.className =
    "message-action-title";


  title.textContent =
    message.senderUid === currentUser.uid
      ? "پیام شما"
      : message.senderName || "پیام";


  menu.appendChild(title);


  const buttons =
    document.createElement("div");


  buttons.className =
    "message-action-buttons";


  /*
    کپی
  */

  buttons.appendChild(
    createActionButton(
      "کپی",
      "copy",
      () => {

        copyMessage(message.text);

        closeMessageActions();

      }
    )
  );


  /*
    پیام خودم
  */

  if (
    message.senderUid === currentUser.uid
  ) {

    buttons.appendChild(
      createActionButton(
        "ویرایش",
        "edit",
        () => {

          closeMessageActions();

          openEditMessage(message);

        }
      )
    );


    buttons.appendChild(
      createActionButton(
        "حذف برای من",
        "danger",
        () => {

          hideMessageForMe(
            message.id
          );

          closeMessageActions();

        }
      )
    );


    const partnerName =
      otherMember?.name ||
      "طرف مقابل";


    buttons.appendChild(
      createActionButton(
        `حذف برای ${partnerName}`,
        "warning",
        () => {

          closeMessageActions();

          confirmDeleteForEveryone(
            message
          );

        }
      )
    );

  }

  /*
    پیام طرف مقابل
  */

  else {

    buttons.appendChild(
      createActionButton(
        "حذف برای من",
        "danger",
        () => {

          hideMessageForMe(
            message.id
          );

          closeMessageActions();

        }
      )
    );

  }


  menu.appendChild(buttons);

  overlay.appendChild(menu);

  document.body.appendChild(overlay);


  requestAnimationFrame(() => {

    overlay.classList.add("show");

  });

}


/* =========================================================
   Action Button
========================================================= */

function createActionButton(
  text,
  type,
  callback
) {

  const button =
    document.createElement("button");


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
   Close Action Menu
========================================================= */

function closeMessageActions() {

  const overlay =
    $(".message-action-overlay");


  if (!overlay) return;


  overlay.classList.remove("show");


  setTimeout(() => {

    overlay.remove();

  }, 180);


  selectedMessage = null;

}


/* =========================================================
   Copy
========================================================= */

async function copyMessage(text) {

  if (!text) return;


  try {

    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {

      await navigator.clipboard.writeText(
        text
      );

    } else {

      const textarea =
        document.createElement("textarea");

      textarea.value =
        text;

      textarea.style.position =
        "fixed";

      textarea.style.opacity =
        "0";

      document.body.appendChild(
        textarea
      );

      textarea.select();

      document.execCommand(
        "copy"
      );

      textarea.remove();

    }


    showToast(
      "پیام کپی شد ✓",
      "success"
    );

  } catch (error) {

    console.error(error);

    showToast(
      "کپی پیام انجام نشد.",
      "error"
    );

  }

}


/* =========================================================
   Hide Message For Me
========================================================= */

function hideMessageForMe(messageId) {

  if (
    !localHiddenMessages.includes(
      messageId
    )
  ) {

    localHiddenMessages.push(
      messageId
    );

  }


  localStorage.setItem(
    `hiddenMessages_${FIXED_DIARY_CODE}`,
    JSON.stringify(
      localHiddenMessages
    )
  );


  renderMessages();

  updateStats();


  showToast(
    "پیام فقط برای شما حذف شد.",
    "success"
  );

}


/* =========================================================
   Edit Message
========================================================= */

function openEditMessage(message) {

  const overlay =
    document.createElement("div");


  overlay.className =
    "modal-overlay";


  const card =
    document.createElement("div");


  card.className =
    "modal-card";


  const title =
    document.createElement("h3");


  title.textContent =
    "ویرایش پیام";


  const textarea =
    document.createElement("textarea");


  textarea.className =
    "edit-message-input";


  textarea.value =
    message.text || "";


  textarea.rows = 4;


  const actions =
    document.createElement("div");


  actions.className =
    "modal-actions";


  const cancel =
    document.createElement("button");


  cancel.type =
    "button";

  cancel.textContent =
    "انصراف";


  cancel.className =
    "modal-cancel";


  const save =
    document.createElement("button");


  save.type =
    "button";

  save.textContent =
    "ذخیره";


  save.className =
    "modal-confirm";


  cancel.onclick = () => {

    overlay.remove();

  };


  save.onclick = async () => {

    const newText =
      textarea.value.trim();


    if (!newText) {

      showToast(
        "پیام نمی‌تواند خالی باشد.",
        "error"
      );

      return;

    }


    if (
      newText === message.text
    ) {

      overlay.remove();

      return;

    }


    save.disabled = true;


    try {

      await updateDoc(
        doc(
          db,
          "diaries",
          diaryId,
          "messages",
          message.id
        ),
        {
          text: newText,
          edited: true,
          editedAt:
            serverTimestamp()
        }
      );


      overlay.remove();


      showToast(
        "پیام ویرایش شد ✓",
        "success"
      );

    } catch (error) {

      console.error(error);

      save.disabled = false;

      showToast(
        "ویرایش انجام نشد.",
        "error"
      );

    }

  };


  actions.appendChild(cancel);

  actions.appendChild(save);


  card.appendChild(title);

  card.appendChild(textarea);

  card.appendChild(actions);


  overlay.appendChild(card);

  document.body.appendChild(overlay);


  requestAnimationFrame(() => {

    overlay.classList.add("show");

  });


  textarea.focus();

}


/* =========================================================
   Delete For Everyone
========================================================= */

function confirmDeleteForEveryone(message) {

  const overlay =
    document.createElement("div");


  overlay.className =
    "modal-overlay";


  const card =
    document.createElement("div");


  card.className =
    "modal-card delete-modal-card";


  const title =
    document.createElement("h3");


  title.textContent =
    "حذف پیام؟";


  const description =
    document.createElement("p");


  const partnerName =
    otherMember?.name ||
    "طرف مقابل";


  description.textContent =
    `این پیام برای شما و ${partnerName} حذف می‌شود.`;


  const actions =
    document.createElement("div");


  actions.className =
    "modal-actions";


  const cancel =
    document.createElement("button");


  cancel.type =
    "button";


  cancel.textContent =
    "انصراف";


  cancel.className =
    "modal-cancel";


  const confirm =
    document.createElement("button");


  confirm.type =
    "button";


  confirm.textContent =
    `حذف برای ${partnerName}`;


  confirm.className =
    "modal-confirm danger";


  cancel.onclick = () => {

    overlay.remove();

  };


  confirm.onclick =
    async () => {

      confirm.disabled = true;


      try {

        await deleteDoc(
          doc(
            db,
            "diaries",
            diaryId,
            "messages",
            message.id
          )
        );


        overlay.remove();


        showToast(
          `پیام برای ${partnerName} هم حذف شد ✓`,
          "success"
        );

      } catch (error) {

        console.error(error);

        confirm.disabled = false;

        showToast(
          "حذف پیام انجام نشد.",
          "error"
        );

      }

    };


  actions.appendChild(cancel);

  actions.appendChild(confirm);


  card.appendChild(title);

  card.appendChild(description);

  card.appendChild(actions);


  overlay.appendChild(card);


  document.body.appendChild(overlay);


  requestAnimationFrame(() => {

    overlay.classList.add("show");

  });

}


/* =========================================================
   Statistics
========================================================= */

function updateStats() {

  const visibleMessages =
    allMessages.filter(
      message =>
        !localHiddenMessages.includes(
          message.id
        )
    );


  const messageCount =
    visibleMessages.length;


  const favoriteCount =
    visibleMessages.filter(
      message =>
        message.favorite === true
    ).length;


  const days = new Set();


  visibleMessages.forEach(
    message => {

      let date = null;


      if (
        message.createdAt &&
        typeof message.createdAt.toDate === "function"
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


      if (date) {

        days.add(
          date.toLocaleDateString(
            "fa-IR"
          )
        );

      }

    }
  );


  updateStat(
    [
      "#messageCount",
      "#messagesCount",
      "[data-stat='messages']"
    ],
    messageCount
  );


  updateStat(
    [
      "#favoriteCount",
      "#favoritesCount",
      "[data-stat='favorites']"
    ],
    favoriteCount
  );


  updateStat(
    [
      "#daysCount",
      "#recordedDays",
      "[data-stat='days']"
    ],
    days.size
  );

}


function updateStat(selectors, value) {

  const element =
    getElement(...selectors);

  if (element) {

    element.textContent =
      value;

  }

}


/* =========================================================
   Presence
========================================================= */

async function setupPresence() {

  if (!currentUser) return;


  const presenceRef =
    ref(
      realtimeDB,
      `diaries/${diaryId}/presence/${currentUser.uid}`
    );


  try {

    await set(
      presenceRef,
      {
        uid:
          currentUser.uid,

        name:
          currentUserName,

        online:
          true,

        updatedAt:
          rtdbServerTimestamp()
      }
    );


    await onDisconnect(
      presenceRef
    ).update({
      online: false,
      updatedAt:
        rtdbServerTimestamp()
    });


  } catch (error) {

    console.error(
      "Presence error:",
      error
    );

  }

}


/* =========================================================
   Other Presence
========================================================= */

function subscribeOtherPresence() {

  if (
    !otherMember ||
    !currentUser
  ) {
    return;
  }


  if (unsubscribeOtherPresence) {

    unsubscribeOtherPresence();

    unsubscribeOtherPresence =
      null;

  }


  const partnerRef =
    ref(
      realtimeDB,
      `diaries/${diaryId}/presence/${otherMember.uid}`
    );


  unsubscribeOtherPresence =
    onValue(
      partnerRef,
      snapshot => {

        const data =
          snapshot.val();


        const online =
          data?.online === true;


        updateOnlineUI(
          online
        );

      }
    );

}


function updateOnlineUI(online) {

  $$(
    "#partnerStatus",
    "[data-partner-status]",
    ".partner-status"
  ).forEach(element => {

    element.textContent =
      online
        ? "آنلاین"
        : "آفلاین";


    element.classList.toggle(
      "online",
      online
    );

  });

}


/* =========================================================
   Battery
========================================================= */

async function setupBattery() {

  if (!currentUser) return;


  /*
    Web Battery API
  */

  if (
    "getBattery" in navigator
  ) {

    try {

      const battery =
        await navigator.getBattery();


      updateOwnBattery(
        battery
      );


      battery.addEventListener(
        "levelchange",
        () => {
          updateOwnBattery(battery);
        }
      );


      battery.addEventListener(
        "chargingchange",
        () => {
          updateOwnBattery(battery);
        }
      );

    } catch (error) {

      console.log(
        "Battery API unavailable"
      );

    }

  }

}


async function updateOwnBattery(
  battery
) {

  const level =
    Math.round(
      battery.level * 100
    );


  const charging =
    battery.charging;


  const presenceRef =
    ref(
      realtimeDB,
      `diaries/${diaryId}/presence/${currentUser.uid}`
    );


  try {

    await update(
      presenceRef,
      {
        battery:
          level,

        charging:
          charging,

        updatedAt:
          rtdbServerTimestamp()
      }
    );

  } catch (error) {

    console.error(
      error
    );

  }


  renderBattery(
    "own",
    level,
    charging
  );

}


/* =========================================================
   Other Battery
========================================================= */

function subscribeOtherBattery() {

  if (
    !otherMember ||
    !currentUser
  ) {
    return;
  }


  if (unsubscribeOtherBattery) {

    unsubscribeOtherBattery();

    unsubscribeOtherBattery =
      null;

  }


  const partnerRef =
    ref(
      realtimeDB,
      `diaries/${diaryId}/presence/${otherMember.uid}`
    );


  unsubscribeOtherBattery =
    onValue(
      partnerRef,
      snapshot => {

        const data =
          snapshot.val();


        if (
          typeof data?.battery === "number"
        ) {

          renderBattery(
            "other",
            data.battery,
            data.charging === true
          );

        } else {

          renderBattery(
            "other",
            null,
            false
          );

        }

      }
    );

}


/* =========================================================
   Battery UI
========================================================= */

function renderBattery(
  type,
  level,
  charging
) {

  const selectors =
    type === "own"
      ? [
          "#myBattery",
          "#ownBattery",
          "[data-battery='me']"
        ]
      : [
          "#partnerBattery",
          "#otherBattery",
          "[data-battery='other']"
        ];


  const container =
    getElement(...selectors);


  if (!container) return;


  const percent =
    level === null
      ? "—"
      : `${level}%`;


  const chargingIcon =
    charging
      ? " ⚡"
      : "";


  const textElement =
    container.querySelector(
      ".battery-text"
    );


  if (textElement) {

    textElement.textContent =
      `${percent}${chargingIcon}`;

  } else {

    container.textContent =
      `${percent}${chargingIcon}`;

  }


  const fill =
    container.querySelector(
      ".battery-fill"
    );


  if (fill && level !== null) {

    fill.style.width =
      `${level}%`;

  }

}


/* =========================================================
   CALL SYSTEM
========================================================= */

let peerConnection = null;

let currentCallId = null;

let currentCallType = null;

let localStream = null;

let remoteStream = null;

let unsubscribeCurrentCall = null;

let unsubscribeCandidates = null;

let callTimerInterval = null;

let callStartedAt = null;


/* =========================================================
   Setup Calls
========================================================= */

function setupCalls() {

  setupCallButtons();

  setupIncomingCalls();

}


/* =========================================================
   Call Buttons
========================================================= */

function setupCallButtons() {

  const audioButton =
    getElement(
      "#audioCallBtn",
      "#callAudioBtn",
      "[data-call='audio']"
    );


  const videoButton =
    getElement(
      "#videoCallBtn",
      "#callVideoBtn",
      "[data-call='video']"
    );


  if (audioButton) {

    audioButton.onclick =
      () => startCall("audio");

  }


  if (videoButton) {

    videoButton.onclick =
      () => startCall("video");

  }


  const endButton =
    getElement(
      "#endCallBtn",
      "#hangupBtn"
    );


  if (endButton) {

    endButton.onclick =
      endCurrentCall;

  }


  const micButton =
    getElement(
      "#micBtn",
      "#toggleMic"
    );


  if (micButton) {

    micButton.onclick =
      toggleMicrophone;

  }


  const cameraButton =
    getElement(
      "#cameraBtn",
      "#toggleCamera"
    );


  if (cameraButton) {

    cameraButton.onclick =
      toggleCamera;

  }


  const speakerButton =
    getElement(
      "#speakerBtn",
      "#toggleSpeaker"
    );


  if (speakerButton) {

    speakerButton.onclick =
      toggleSpeaker;

  }


  const acceptButton =
    getElement(
      "#acceptCallBtn",
      "#acceptCall"
    );


  if (acceptButton) {

    acceptButton.onclick =
      acceptIncomingCall;

  }


  const rejectButton =
    getElement(
      "#rejectCallBtn",
      "#rejectCall"
    );


  if (rejectButton) {

    rejectButton.onclick =
      rejectIncomingCall;

  }

}


/* =========================================================
   Start Call
========================================================= */

async function startCall(type) {

  if (!otherMember) {

    showToast(
      "هنوز نفر دوم وارد دفترچه نشده.",
      "error"
    );

    return;

  }


  if (
    currentCallId ||
    peerConnection
  ) {

    showToast(
      "در حال حاضر یک تماس فعال است.",
      "error"
    );

    return;

  }


  currentCallType =
    type;


  try {

    localStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
        video:
          type === "video"
      });


  } catch (error) {

    console.error(error);

    showToast(
      type === "video"
        ? "دسترسی دوربین و میکروفون داده نشد."
        : "دسترسی میکروفون داده نشد.",
      "error"
    );

    return;

  }


  showCallScreen(
    "در حال برقراری تماس..."
  );


  const callRef =
    await addDoc(
      collection(
        db,
        "diaries",
        diaryId,
        "calls"
      ),
      {
        callerUid:
          currentUser.uid,

        callerName:
          currentUserName,

        calleeUid:
          otherMember.uid,

        type,

        status:
          "ringing",

        createdAt:
          serverTimestamp()
      }
    );


  currentCallId =
    callRef.id;


  peerConnection =
    createPeerConnection(
      true
    );


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


  const offer =
    await peerConnection.createOffer();


  await peerConnection.setLocalDescription(
    offer
  );


  await updateDoc(
    callRef,
    {
      offer: {
        type:
          offer.type,

        sdp:
          offer.sdp
      }
    }
  );


  subscribeCallerCall(
    callRef.id
  );

}


/* =========================================================
   Create Peer Connection
========================================================= */

function createPeerConnection(
  isCaller
) {

  const pc =
    new RTCPeerConnection({
      iceServers: [
        {
          urls:
            "stun:stun.l.google.com:19302"
        }
      ]
    });


  remoteStream =
    new MediaStream();


  const remoteVideo =
    getElement(
      "#remoteVideo",
      "#remoteVideoElement"
    );


  if (remoteVideo) {

    remoteVideo.srcObject =
      remoteStream;

  }


  pc.ontrack =
    event => {

      event.streams[0]
        ?.getTracks()
        .forEach(
          track => {

            remoteStream.addTrack(
              track
            );

          }
        );

    };


  pc.onconnectionstatechange =
    () => {

      if (
        [
          "connected"
        ].includes(
          pc.connectionState
        )
      ) {

        updateCallStatusText(
          "تماس برقرار است"
        );

        startCallTimer();

      }


      if (
        [
          "failed",
          "disconnected",
          "closed"
        ].includes(
          pc.connectionState
        )
      ) {

        cleanupCall();

      }

    };


  pc.onicecandidate =
    async event => {

      if (!event.candidate) {
        return;
      }


      if (!currentCallId) {
        return;
      }


      const collectionName =
        isCaller
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


  return pc;

}


/* =========================================================
   Caller Listener
========================================================= */

function subscribeCallerCall(
  callId
) {

  if (unsubscribeCurrentCall) {

    unsubscribeCurrentCall();

  }


  const callRef =
    doc(
      db,
      "diaries",
      diaryId,
      "calls",
      callId
    );


  unsubscribeCurrentCall =
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
          !peerConnection.currentRemoteDescription
        ) {

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
              data.answer
            )
          );

          updateCallStatusText(
            "در حال اتصال..."
          );

        }


        if (
          data.status === "rejected" ||
          data.status === "ended"
        ) {

          cleanupCall();

        }

      }
    );


  subscribeCandidates(
    callId,
    "calleeCandidates"
  );

}


/* =========================================================
   Incoming Calls
========================================================= */

function setupIncomingCalls() {

  if (!currentUser) return;


  const callsRef =
    collection(
      db,
      "diaries",
      diaryId,
      "calls"
    );


  const incomingQuery =
    query(
      callsRef,
      where(
        "calleeUid",
        "==",
        currentUser.uid
      )
    );


  onSnapshot(
    incomingQuery,
    snapshot => {

      const calls =
        snapshot.docs
          .map(
            item => ({
              id: item.id,
              ...item.data()
            })
          )
          .filter(
            call =>
              call.status === "ringing"
          );


      if (!calls.length) return;


      const call =
        calls[
          calls.length - 1
        ];


      if (
        currentCallId ||
        peerConnection
      ) {
        return;
      }


      currentCallId =
        call.id;


      currentCallType =
        call.type;


      showIncomingCall(
        call
      );

    },
    error => {

      console.error(
        "Incoming call:",
        error
      );

    }
  );

}


/* =========================================================
   Incoming Call UI
========================================================= */

let pendingIncomingCall = null;


function showIncomingCall(call) {

  pendingIncomingCall =
    call;


  const modal =
    getElement(
      "#incomingCallModal",
      ".incoming-call-modal"
    );


  if (modal) {

    modal.classList.add(
      "show"
    );


    const name =
      modal.querySelector(
        "[data-caller-name], .caller-name"
      );


    if (name) {

      name.textContent =
        call.callerName ||
        "تماس ورودی";

    }


    return;

  }


  /*
    اگر HTML مودال نداشت،
    خودمان می‌سازیم.
  */

  const overlay =
    document.createElement("div");


  overlay.id =
    "incomingCallModal";


  overlay.className =
    "modal-overlay incoming-call-modal show";


  const card =
    document.createElement("div");


  card.className =
    "modal-card";


  const title =
    document.createElement("h3");


  title.textContent =
    call.type === "video"
      ? "تماس تصویری ورودی"
      : "تماس صوتی ورودی";


  const name =
    document.createElement("p");


  name.textContent =
    call.callerName ||
    "نفر دیگر";


  const actions =
    document.createElement("div");


  actions.className =
    "modal-actions";


  const reject =
    document.createElement("button");


  reject.textContent =
    "رد تماس";


  reject.className =
    "modal-cancel";


  const accept =
    document.createElement("button");


  accept.textContent =
    "پاسخ دادن";


  accept.className =
    "modal-confirm";


  reject.onclick =
    rejectIncomingCall;


  accept.onclick =
    acceptIncomingCall;


  actions.appendChild(
    reject
  );

  actions.appendChild(
    accept
  );


  card.appendChild(title);

  card.appendChild(name);

  card.appendChild(actions);


  overlay.appendChild(card);

  document.body.appendChild(
    overlay
  );

}


/* =========================================================
   Accept Incoming Call
========================================================= */

async function acceptIncomingCall() {

  if (!pendingIncomingCall) {

    /*
      اگر مودال HTML دستی باشد،
      callId از currentCallId گرفته می‌شود.
    */

    if (!currentCallId) {
      return;
    }

  }


  const callId =
    pendingIncomingCall?.id ||
    currentCallId;


  try {

    const callRef =
      doc(
        db,
        "diaries",
        diaryId,
        "calls",
        callId
      );


    const snapshot =
      await getDoc(callRef);


    if (!snapshot.exists()) {

      cleanupCall();

      return;

    }


    const call =
      snapshot.data();


    currentCallId =
      callId;

    currentCallType =
      call.type;


    localStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
        video:
          call.type === "video"
      });


    hideIncomingCall();


    showCallScreen(
      "در حال اتصال..."
    );


    peerConnection =
      createPeerConnection(
        false
      );


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


    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(
        call.offer
      )
    );


    const answer =
      await peerConnection.createAnswer();


    await peerConnection.setLocalDescription(
      answer
    );


    await updateDoc(
      callRef,
      {
        answer: {
          type:
            answer.type,

          sdp:
            answer.sdp
        },

        status:
          "accepted"
      }
    );


    subscribeCandidates(
      callId,
      "callerCandidates"
    );


  } catch (error) {

    console.error(error);

    showToast(
      "پاسخ دادن به تماس انجام نشد.",
      "error"
    );

    cleanupCall();

  }

}


/* =========================================================
   Reject Incoming Call
========================================================= */

async function rejectIncomingCall() {

  const callId =
    pendingIncomingCall?.id ||
    currentCallId;


  if (!callId) {

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
        callId
      ),
      {
        status:
          "rejected"
      }
    );

  } catch (error) {

    console.error(error);

  }


  hideIncomingCall();

  pendingIncomingCall =
    null;

  currentCallId =
    null;

}


/* =========================================================
   Candidates
========================================================= */

function subscribeCandidates(
  callId,
  collectionName
) {

  if (unsubscribeCandidates) {

    unsubscribeCandidates();

  }


  const candidatesRef =
    collection(
      db,
      "diaries",
      diaryId,
      "calls",
      callId,
      collectionName
    );


  unsubscribeCandidates =
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


              if (!peerConnection) {
                return;
              }


              try {

                await peerConnection.addIceCandidate(
                  new RTCIceCandidate(
                    change.doc.data()
                  )
                );

              } catch (error) {

                console.error(
                  "ICE error:",
                  error
                );

              }

            }
          );

      }
    );

}


/* =========================================================
   Call Screen
========================================================= */

function showCallScreen(
  text
) {

  const screen =
    getElement(
      "#callScreen",
      ".call-screen"
    );


  if (!screen) return;


  screen.classList.add(
    "show",
    "active"
  );


  const status =
    screen.querySelector(
      ".call-status, #callStatus"
    );


  if (status) {

    status.textContent =
      text;

  }


  const localVideo =
    screen.querySelector(
      "#localVideo"
    );


  if (
    localVideo &&
    localStream
  ) {

    localVideo.srcObject =
      localStream;

  }

}


function hideCallScreen() {

  const screen =
    getElement(
      "#callScreen",
      ".call-screen"
    );


  if (!screen) return;


  screen.classList.remove(
    "show",
    "active"
  );

}


/* =========================================================
   Call Status
========================================================= */

function updateCallStatusText(
  text
) {

  const element =
    getElement(
      "#callStatus",
      ".call-status"
    );


  if (element) {

    element.textContent =
      text;

  }

}


/* =========================================================
   Call Timer
========================================================= */

function startCallTimer() {

  if (callTimerInterval) {
    clearInterval(
      callTimerInterval
    );
  }


  callStartedAt =
    Date.now();


  callTimerInterval =
    setInterval(() => {

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


      const secs =
        seconds % 60;


      const timer =
        getElement(
          "#callTimer",
          ".call-timer"
        );


      if (timer) {

        timer.textContent =
          `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

      }

    }, 1000);

}


/* =========================================================
   Microphone
========================================================= */

function toggleMicrophone() {

  if (!localStream) return;


  const track =
    localStream.getAudioTracks()[0];


  if (!track) return;


  track.enabled =
    !track.enabled;


  const button =
    getElement(
      "#micBtn",
      "#toggleMic"
    );


  if (button) {

    button.classList.toggle(
      "off",
      !track.enabled
    );

  }

}


/* =========================================================
   Camera
========================================================= */

function toggleCamera() {

  if (!localStream) return;


  const track =
    localStream.getVideoTracks()[0];


  if (!track) return;


  track.enabled =
    !track.enabled;


  const button =
    getElement(
      "#cameraBtn",
      "#toggleCamera"
    );


  if (button) {

    button.classList.toggle(
      "off",
      !track.enabled
    );

  }

}


/* =========================================================
   Speaker
========================================================= */

function toggleSpeaker() {

  const remoteVideo =
    getElement(
      "#remoteVideo",
      "#remoteVideoElement"
    );


  if (!remoteVideo) return;


  remoteVideo.muted =
    !remoteVideo.muted;


  const button =
    getElement(
      "#speakerBtn",
      "#toggleSpeaker"
    );


  if (button) {

    button.classList.toggle(
      "off",
      remoteVideo.muted
    );

  }

}


/* =========================================================
   End Call
========================================================= */

async function endCurrentCall() {

  if (currentCallId) {

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
            "ended"
        }
      );

    } catch (error) {

      console.error(
        error
      );

    }

  }


  cleanupCall();

}


/* =========================================================
   Cleanup Call
========================================================= */

function cleanupCall() {

  if (callTimerInterval) {

    clearInterval(
      callTimerInterval
    );

    callTimerInterval =
      null;

  }


  if (unsubscribeCurrentCall) {

    unsubscribeCurrentCall();

    unsubscribeCurrentCall =
      null;

  }


  if (unsubscribeCandidates) {

    unsubscribeCandidates();

    unsubscribeCandidates =
      null;

  }


  if (peerConnection) {

    peerConnection.close();

    peerConnection =
      null;

  }


  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

    localStream =
      null;

  }


  remoteStream =
    null;


  currentCallId =
    null;


  currentCallType =
    null;


  pendingIncomingCall =
    null;


  hideCallScreen();

  hideIncomingCall();

}


/* =========================================================
   Hide Incoming
========================================================= */

function hideIncomingCall() {

  const modal =
    getElement(
      "#incomingCallModal",
      ".incoming-call-modal"
    );


  if (!modal) return;


  modal.classList.remove(
    "show"
  );


  /*
    مودال‌هایی که توسط JS ساخته شده‌اند
  */

  if (
    modal.id ===
      "incomingCallModal" &&
    !modal.dataset.static
  ) {

    setTimeout(() => {

      if (
        modal.parentNode
      ) {
        modal.remove();
      }

    }, 200);

  }

}


/* =========================================================
   Logout
========================================================= */

async function logout() {

  try {

    await signOut(auth);

    currentUser =
      null;

    currentUserName =
      "";

    otherMember =
      null;

    everythingInitialized =
      false;

    if (unsubscribeMembers) {
      unsubscribeMembers();
    }

    if (unsubscribeMessages) {
      unsubscribeMessages();
    }

    if (unsubscribeOtherPresence) {
      unsubscribeOtherPresence();
    }

    if (unsubscribeOtherBattery) {
      unsubscribeOtherBattery();
    }

    cleanupCall();

    showLoginScreen();

  } catch (error) {

    console.error(error);

  }

}


const logoutButton =
  getElement(
    "#logoutBtn",
    "#logout",
    ".logout-btn"
  );


if (logoutButton) {

  logoutButton.addEventListener(
    "click",
    logout
  );

}


/* =========================================================
   Global Escape
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape"
    ) {

      closeMessageActions();

      $$(".modal-overlay")
        .forEach(
          modal => {

            if (
              !modal.classList.contains(
                "incoming-call-modal"
              )
            ) {
              modal.remove();
            }

          }
        );

    }

  }
);


/* =========================================================
   Initial
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupLogin();

    setupTheme();

    /*
      اگر کاربر قبلاً لاگین کرده
      Firebase خودش onAuthStateChanged
      را اجرا می‌کند.
    */

  }
);
