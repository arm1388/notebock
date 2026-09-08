/* =========================================================
   دفترچه خاطرات مشترک
   Firebase + Firestore + Realtime Database + WebRTC
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
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  where
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
   FIREBASE CONFIG
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


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;

let diaryId = "";
let currentName = "";

let members = [];
let otherMember = null;

let unsubscribeMembers = null;
let unsubscribeMessages = null;
let unsubscribePresence = null;
let unsubscribeBattery = null;
let unsubscribeIncomingCalls = null;
let unsubscribeCurrentCall = null;
let unsubscribeCandidates = null;

let currentMessages = [];

let toastTimer = null;


/* =========================================================
   BATTERY
========================================================= */

let myBatteryLevel = null;
let myCharging = false;


/* =========================================================
   WEBRTC STATE
========================================================= */

let peerConnection = null;

let localStream = null;
let remoteStream = null;

let currentCallId = null;
let currentCallType = null;
let currentCallRole = null;

let pendingIncomingCall = null;

let callTimerInterval = null;
let callStartedAt = null;

let micEnabled = false;
let cameraEnabled = false;
let speakerEnabled = true;


/* =========================================================
   RTC CONFIG
========================================================= */

const rtcConfig = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302"
      ]
    }
  ]
};


/* =========================================================
   DOM HELPERS
========================================================= */

function $(id) {
  return document.getElementById(id);
}


function getMessagesContainer() {
  return (
    $("messages") ||
    $("chatMessages") ||
    $("messagesContainer")
  );
}


function getMessageInput() {
  return (
    $("messageInput") ||
    $("chatInput")
  );
}


function getSendButton() {
  return (
    $("sendMessageBtn") ||
    $("sendBtn")
  );
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message, icon = "✓") {

  const toast = $("toast");
  const toastMessage = $("toastMessage");
  const toastIcon = $("toastIcon");

  if (!toast || !toastMessage) {
    alert(message);
    return;
  }

  toastMessage.textContent = message;

  if (toastIcon) {
    toastIcon.textContent = icon;
  }

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}


/* =========================================================
   SAFE TEXT
========================================================= */

function escapeHTML(value) {

  const div = document.createElement("div");

  div.textContent = value ?? "";

  return div.innerHTML;
}


/* =========================================================
   PERSIAN DATE
========================================================= */

function formatDate(timestamp) {

  if (!timestamp) {
    return "";
  }

  let date;

  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "fa-IR",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}


/* =========================================================
   LOGIN
========================================================= */

async function login() {

  const codeInput = $("diaryCode");
  const nameInput = $("userName");

  if (!codeInput || !nameInput) {
    return;
  }

  const code = codeInput.value.trim();
  const name = nameInput.value.trim();

  if (!code) {
    showToast("کد دفترچه را وارد کنید", "⚠️");
    codeInput.focus();
    return;
  }

  if (!name) {
    showToast("نام خود را وارد کنید", "⚠️");
    nameInput.focus();
    return;
  }

  if (code.length < 3) {
    showToast("کد دفترچه باید حداقل ۳ کاراکتر باشد", "⚠️");
    return;
  }

  if (name.length < 2) {
    showToast("نام وارد شده کوتاه است", "⚠️");
    return;
  }


  const button = $("loginBtn");

  if (button) {
    button.disabled = true;
    button.style.opacity = "0.6";
  }


  try {

    if (!currentUser) {
      await signInAnonymously(auth);
    }

    currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("AUTH_FAILED");
    }


    diaryId = normalizeDiaryCode(code);

    currentName = name;


    const memberRef = doc(
      db,
      "diaries",
      diaryId,
      "members",
      currentUser.uid
    );

    const memberSnapshot = await getDoc(memberRef);


    if (!memberSnapshot.exists()) {

      await setDoc(memberRef, {
        uid: currentUser.uid,
        name: currentName,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      });

    } else {

      await updateDoc(memberRef, {
        name: currentName,
        lastSeen: serverTimestamp()
      });

    }


    localStorage.setItem(
      "sharedDiaryCode",
      diaryId
    );

    localStorage.setItem(
      "sharedDiaryName",
      currentName
    );


    openApp();

    await setupEverything();

    showToast(
      "با موفقیت وارد دفترچه شدید 💜",
      "✓"
    );

  } catch (error) {

    console.error("LOGIN ERROR:", error);

    showToast(
      firebaseErrorMessage(error),
      "❌"
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.style.opacity = "1";
    }

  }
}


/* =========================================================
   NORMALIZE DIARY CODE
========================================================= */

function normalizeDiaryCode(code) {

  return code
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}


/* =========================================================
   FIREBASE ERROR MESSAGE
========================================================= */

function firebaseErrorMessage(error) {

  const code = error?.code || "";

  if (code.includes("permission-denied")) {
    return "دسترسی به دفترچه امکان‌پذیر نیست";
  }

  if (code.includes("network")) {
    return "اتصال اینترنت را بررسی کنید";
  }

  if (code.includes("auth")) {
    return "ورود به Firebase انجام نشد";
  }

  return "خطایی رخ داد؛ دوباره امتحان کنید";
}


/* =========================================================
   OPEN APP
========================================================= */

function openApp() {

  const loginScreen = $("loginScreen");
  const appScreen = $("appScreen");

  if (loginScreen) {
    loginScreen.classList.add("hidden");
  }

  if (appScreen) {
    appScreen.classList.remove("hidden");
  }


  if ($("currentDiaryCode")) {
    $("currentDiaryCode").textContent = diaryId;
  }

  if ($("diaryCodeDisplay")) {
    $("diaryCodeDisplay").textContent = diaryId;
  }

  if ($("myName")) {
    $("myName").textContent = currentName;
  }

  if ($("chatStatus")) {
    $("chatStatus").textContent = "دفترچه مشترک";
  }
}


/* =========================================================
   SETUP EVERYTHING
========================================================= */

async function setupEverything() {

  cleanupSubscriptions();

  subscribeMembers();

  subscribeMessages();

  setupPresence();

  setupBattery();

  setupIncomingCalls();

  setupTheme();

  setupNavigation();

  setupChat();

  updateMyBatteryUI();

  updateCallButtonsUI();
}


/* =========================================================
   MEMBERS
========================================================= */

function subscribeMembers() {

  if (!diaryId) {
    return;
  }


  const membersRef = collection(
    db,
    "diaries",
    diaryId,
    "members"
  );


  unsubscribeMembers = onSnapshot(
    membersRef,
    snapshot => {

      members = [];

      snapshot.forEach(item => {

        members.push({
          id: item.id,
          ...item.data()
        });

      });


      otherMember =
        members.find(
          member =>
            member.uid !== currentUser?.uid
        ) || null;


      updatePartnerUI();

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
   PARTNER UI
========================================================= */

function updatePartnerUI() {

  const name =
    otherMember?.name ||
    "نفر دیگر";


  const ids = [
    "otherName",
    "partnerName",
    "chatPartnerName"
  ];


  ids.forEach(id => {

    const element = $(id);

    if (element) {
      element.textContent = name;
    }

  });


  if ($("partnerStatus")) {

    $("partnerStatus").textContent =
      "● در حال بررسی...";

  }
}


/* =========================================================
   MESSAGES
========================================================= */

function subscribeMessages() {

  if (!diaryId) {
    return;
  }


  const messagesRef = collection(
    db,
    "diaries",
    diaryId,
    "messages"
  );


  const messagesQuery = query(
    messagesRef,
    orderBy("createdAt", "asc")
  );


  unsubscribeMessages = onSnapshot(
    messagesQuery,
    snapshot => {

      currentMessages = [];

      snapshot.forEach(item => {

        currentMessages.push({
          id: item.id,
          ...item.data()
        });

      });


      renderMessages();

      updateStats();

    },
    error => {

      console.error(
        "MESSAGES ERROR:",
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

  const container = getMessagesContainer();

  if (!container) {
    return;
  }


  container.innerHTML = "";


  if (!currentMessages.length) {

    const empty = document.createElement("div");

    empty.className = "empty-messages";

    empty.innerHTML = `
      <div style="
        text-align:center;
        padding:50px 20px;
        color:var(--text-soft);
      ">
        <div style="font-size:42px;margin-bottom:12px;">
          💜
        </div>

        <div style="
          font-weight:700;
          font-size:13px;
        ">
          هنوز پیامی اینجا نیست
        </div>

        <div style="
          margin-top:5px;
          font-size:10px;
        ">
          اولین پیام را شما بفرستید
        </div>
      </div>
    `;

    container.appendChild(empty);

    return;
  }


  currentMessages.forEach(message => {

    const mine =
      message.senderUid === currentUser?.uid;


    const bubble =
      document.createElement("div");


    bubble.className =
      `message ${mine ? "mine" : "theirs"}`;


    const senderName =
      message.senderName ||
      (mine ? currentName : "نفر دیگر");


    const text =
      escapeHTML(message.text || "")
        .replace(/\n/g, "<br>");


    const time =
      formatDate(message.createdAt);


    bubble.innerHTML = `
      <div class="message-name">
        ${escapeHTML(senderName)}
      </div>

      <div class="message-text">
        ${text}
      </div>

      ${
        time
          ? `<div class="message-time">${time}</div>`
          : ""
      }
    `;


    container.appendChild(bubble);

  });


  requestAnimationFrame(() => {

    container.scrollTop =
      container.scrollHeight;

  });
}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

  const input = getMessageInput();

  if (!input || !diaryId || !currentUser) {
    return;
  }


  const text =
    input.value.trim();


  if (!text) {
    return;
  }


  if (text.length > 2000) {
    showToast(
      "پیام خیلی طولانی است",
      "⚠️"
    );

    return;
  }


  const button = getSendButton();

  if (button) {
    button.disabled = true;
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
        favorite: false,
        createdAt: serverTimestamp()
      }
    );


    input.value = "";

    autoResizeTextarea();

  } catch (error) {

    console.error(
      "SEND MESSAGE ERROR:",
      error
    );

    showToast(
      "پیام ارسال نشد",
      "❌"
    );

  } finally {

    if (button) {
      button.disabled = false;
    }

  }
}


/* =========================================================
   CHAT
========================================================= */

function setupChat() {

  const input = getMessageInput();
  const button = getSendButton();


  if (button) {

    button.onclick = sendMessage;

  }


  if (input) {

    input.addEventListener(
      "input",
      autoResizeTextarea
    );


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
   TEXTAREA AUTO RESIZE
========================================================= */

function autoResizeTextarea() {

  const input = getMessageInput();

  if (!input) {
    return;
  }


  input.style.height = "auto";

  input.style.height =
    Math.min(
      input.scrollHeight,
      120
    ) + "px";
}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

  const memoryCount =
    $("memoryCount");

  const favoriteCount =
    $("favoriteCount");

  const daysCount =
    $("daysCount");


  if (memoryCount) {
    memoryCount.textContent =
      currentMessages.length;
  }


  if (favoriteCount) {

    const favorites =
      currentMessages.filter(
        message =>
          message.favorite === true
      ).length;

    favoriteCount.textContent =
      favorites;
  }


  if (daysCount) {

    const days = new Set();

    currentMessages.forEach(message => {

      if (!message.createdAt) {
        return;
      }

      let date;

      try {

        date =
          message.createdAt.toDate
            ? message.createdAt.toDate()
            : new Date(message.createdAt);

      } catch {
        return;
      }

      if (!isNaN(date.getTime())) {

        days.add(
          date.toISOString().slice(0, 10)
        );

      }

    });


    daysCount.textContent =
      days.size;
  }
}


/* =========================================================
   PRESENCE
========================================================= */

function setupPresence() {

  if (!diaryId || !currentUser) {
    return;
  }


  const presenceRef = ref(
    rtdb,
    `diaries/${diaryId}/presence/${currentUser.uid}`
  );


  onDisconnect(presenceRef)
    .set({
      online: false,
      lastSeen: rtdbServerTimestamp()
    })
    .catch(error => {

      console.error(
        "PRESENCE DISCONNECT:",
        error
      );

    });


  set(
    presenceRef,
    {
      online: true,
      name: currentName,
      lastSeen: rtdbServerTimestamp()
    }
  ).catch(error => {

    console.error(
      "PRESENCE SET:",
      error
    );

  });


  if (otherMember) {
    subscribeOtherPresence();
  }


  if (unsubscribeMembers) {

    // Presence دوباره در updatePartnerUI
    // تنظیم می‌شود.
  }
}


/* =========================================================
   OTHER PRESENCE
========================================================= */

function subscribeOtherPresence() {

  if (
    !diaryId ||
    !otherMember?.uid
  ) {
    return;
  }


  if (unsubscribePresence) {
    unsubscribePresence();
    unsubscribePresence = null;
  }


  const otherPresenceRef = ref(
    rtdb,
    `diaries/${diaryId}/presence/${otherMember.uid}`
  );


  unsubscribePresence = onValue(
    otherPresenceRef,
    snapshot => {

      const data =
        snapshot.val();


      const online =
        data?.online === true;


      const status =
        $("partnerStatus");


      if (status) {

        status.textContent =
          online
            ? "● آنلاین"
            : "● آفلاین";

        status.style.color =
          online
            ? "var(--success)"
            : "var(--text-soft)";
      }

    },
    error => {

      console.error(
        "PRESENCE READ:",
        error
      );

    }
  );
}


/* =========================================================
   BATTERY
========================================================= */

async function setupBattery() {

  if (!diaryId || !currentUser) {
    return;
  }


  try {

    if (
      "getBattery" in navigator
    ) {

      const battery =
        await navigator.getBattery();


      updateMyBattery(
        battery
      );


      battery.addEventListener(
        "levelchange",
        () => updateMyBattery(battery)
      );


      battery.addEventListener(
        "chargingchange",
        () => updateMyBattery(battery)
      );

    } else {

      updateBatteryText(
        $("myBattery"),
        "--"
      );

      updateBatteryText(
        $("myCharging"),
        "اطلاعات شارژ در دسترس نیست"
      );

    }

  } catch (error) {

    console.error(
      "BATTERY ERROR:",
      error
    );

  }


  subscribeOtherBattery();

}


/* =========================================================
   MY BATTERY
========================================================= */

async function updateMyBattery(
  battery
) {

  if (!battery) {
    return;
  }


  myBatteryLevel =
    Math.round(
      battery.level * 100
    );


  myCharging =
    battery.charging === true;


  updateMyBatteryUI();


  const batteryRef = ref(
    rtdb,
    `diaries/${diaryId}/presence/${currentUser.uid}/battery`
  );


  try {

    await update(
      ref(
        rtdb,
        `diaries/${diaryId}/presence/${currentUser.uid}`
      ),
      {
        battery: myBatteryLevel,
        charging: myCharging
      }
    );

  } catch (error) {

    console.error(
      "BATTERY SYNC ERROR:",
      error
    );

  }
}


/* =========================================================
   UPDATE MY BATTERY UI
========================================================= */

function updateMyBatteryUI() {

  const battery =
    $("myBattery");

  const fill =
    $("myBatteryFill");

  const charging =
    $("myCharging");


  if (myBatteryLevel === null) {

    if (battery) {
      battery.textContent = "--";
    }

    if (charging) {
      charging.textContent =
        "در حال بررسی...";
    }

    return;
  }


  if (battery) {

    battery.textContent =
      `${myBatteryLevel}%`;

  }


  if (fill) {

    fill.style.width =
      `${myBatteryLevel}%`;

  }


  if (charging) {

    charging.textContent =
      myCharging
        ? "⚡ در حال شارژ"
        : "در حال استفاده";

  }
}


/* =========================================================
   OTHER BATTERY
========================================================= */

function subscribeOtherBattery() {

  if (
    !diaryId ||
    !otherMember?.uid
  ) {
    return;
  }


  if (unsubscribeBattery) {
    unsubscribeBattery();
    unsubscribeBattery = null;
  }


  const batteryRef = ref(
    rtdb,
    `diaries/${diaryId}/presence/${otherMember.uid}`
  );


  unsubscribeBattery = onValue(
    batteryRef,
    snapshot => {

      const data =
        snapshot.val();


      const battery =
        $("otherBattery");

      const fill =
        $("otherBatteryFill");

      const charging =
        $("otherCharging");


      if (
        typeof data?.battery === "number"
      ) {

        const level =
          Math.round(data.battery);


        if (battery) {
          battery.textContent =
            `${level}%`;
        }

        if (fill) {
          fill.style.width =
            `${level}%`;
        }

      } else {

        if (battery) {
          battery.textContent =
            "--";
        }

        if (fill) {
          fill.style.width =
            "0%";
        }

      }


      if (charging) {

        charging.textContent =
          data?.charging === true
            ? "⚡ در حال شارژ"
            : data?.online === true
              ? "در حال استفاده"
              : "آفلاین";

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
   THEME
========================================================= */

function setupTheme() {

  const saved =
    localStorage.getItem(
      "diaryTheme"
    );


  if (saved === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }


  const themeButtons = [
    $("themeToggle"),
    $("darkModeToggle")
  ];


  themeButtons.forEach(button => {

    if (!button) {
      return;
    }


    button.onclick = toggleTheme;

  });


  updateThemeButton();
}


/* =========================================================
   TOGGLE THEME
========================================================= */

function toggleTheme() {

  document.body.classList.toggle("dark");


  const dark =
    document.body.classList.contains("dark");


  localStorage.setItem(
    "diaryTheme",
    dark ? "dark" : "light"
  );


  updateThemeButton();
}


/* =========================================================
   UPDATE THEME BUTTON
========================================================= */

function updateThemeButton() {

  const dark =
    document.body.classList.contains("dark");


  const button =
    $("themeToggle");


  if (button) {

    button.textContent =
      dark ? "☀️" : "🌙";

  }
}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

  const navItems =
    document.querySelectorAll(
      ".nav-item[data-page]"
    );


  navItems.forEach(item => {

    item.onclick = () => {

      const pageId =
        item.dataset.page;


      document
        .querySelectorAll(".page")
        .forEach(page => {

          page.classList.remove(
            "active-page"
          );

        });


      const page =
        $(pageId);


      if (page) {
        page.classList.add(
          "active-page"
        );
      }


      navItems.forEach(nav => {

        nav.classList.remove(
          "active"
        );

      });


      item.classList.add(
        "active"
      );

    };

  });
}


/* =========================================================
   FIND OTHER MEMBER
========================================================= */

function getOtherMember() {

  return (
    members.find(
      member =>
        member.uid !== currentUser?.uid
    ) || null
  );
}


/* =========================================================
   CALL BUTTON EVENTS
========================================================= */

function setupCallButtons() {

  const audioCallBtn =
    $("audioCallBtn");

  const videoCallBtn =
    $("videoCallBtn");

  const acceptCallBtn =
    $("acceptCallBtn");

  const rejectCallBtn =
    $("rejectCallBtn");

  const endCallBtn =
    $("endCallBtn");

  const micBtn =
    $("micBtn");

  const cameraBtn =
    $("cameraBtn");

  const speakerBtn =
    $("speakerBtn");


  if (audioCallBtn) {

    audioCallBtn.onclick =
      () => startOutgoingCall("audio");

  }


  if (videoCallBtn) {

    videoCallBtn.onclick =
      () => startOutgoingCall("video");

  }


  if (acceptCallBtn) {

    acceptCallBtn.onclick =
      acceptIncomingCall;

  }


  if (rejectCallBtn) {

    rejectIncomingCall();

  }


  if (endCallBtn) {

    endCallBtn.onclick =
      endCurrentCall;

  }


  if (micBtn) {

    micBtn.onclick =
      toggleMicrophone;

  }


  if (cameraBtn) {

    cameraBtn.onclick =
      toggleCamera;

  }


  if (speakerBtn) {

    speakerBtn.onclick =
      toggleSpeaker;

  }


  updateCallButtonsUI();
}


/* =========================================================
   CALL BUTTON UI
========================================================= */

function updateCallButtonsUI() {

  const micBtn =
    $("micBtn");

  const cameraBtn =
    $("cameraBtn");

  const speakerBtn =
    $("speakerBtn");


  if (micBtn) {

    micBtn.textContent =
      micEnabled
        ? "🎙️"
        : "🔇";

    micBtn.style.opacity =
      micEnabled ? "1" : "0.55";

  }


  if (cameraBtn) {

    cameraBtn.textContent =
      cameraEnabled
        ? "📷"
        : "🚫";

    cameraBtn.style.opacity =
      cameraEnabled ? "1" : "0.55";

  }


  if (speakerBtn) {

    speakerBtn.textContent =
      speakerEnabled
        ? "🔊"
        : "🔇";

    speakerBtn.style.opacity =
      speakerEnabled ? "1" : "0.55";

  }
}


/* =========================================================
   START OUTGOING CALL
========================================================= */

async function startOutgoingCall(
  type
) {

  if (!currentUser) {
    showToast(
      "ابتدا وارد دفترچه شوید",
      "⚠️"
    );

    return;
  }


  const partner =
    getOtherMember();


  if (!partner) {

    showToast(
      "نفر دیگر هنوز وارد دفترچه نشده است",
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

    currentCallType =
      type;

    currentCallRole =
      "caller";


    /*
      مهم:

      در شروع هر تماس:
      میکروفون خاموش است.

      در تماس تصویری:
      دوربین هم خاموش است.
    */

    micEnabled = false;
    cameraEnabled = false;
    speakerEnabled = true;


    localStream =
      await getLocalMedia(type);


    peerConnection =
      createPeerConnection(
        "caller"
      );


    localStream
      .getTracks()
      .forEach(track => {

        peerConnection.addTrack(
          track,
          localStream
        );

      });


    const offer =
      await peerConnection.createOffer();


    await peerConnection.setLocalDescription(
      offer
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
          callerUid: currentUser.uid,
          callerName: currentName,

          calleeUid: partner.uid,
          calleeName: partner.name,

          type: type,

          status: "ringing",

          offer: {
            type: offer.type,
            sdp: offer.sdp
          },

          createdAt: serverTimestamp()
        }
      );


    currentCallId =
      callRef.id;


    setupCurrentCallListener();

    setupCandidateListener(
      "calleeCandidates"
    );


    showCallScreen(
      partner.name,
      type
    );


    setCallStatus(
      "در حال برقراری تماس..."
    );


    updateCallButtonsUI();


  } catch (error) {

    console.error(
      "OUTGOING CALL ERROR:",
      error
    );


    cleanupCall();


    showToast(
      getMediaErrorMessage(error),
      "❌"
    );

  }
}


/* =========================================================
   GET LOCAL MEDIA
========================================================= */

async function getLocalMedia(
  type
) {

  /*
    AUDIO CALL:
    فقط میکروفون گرفته می‌شود.
    اما disabled = false می‌کنیم
    تا در شروع تماس میکروفون خاموش باشد.

    VIDEO CALL:
    دوربین + میکروفون گرفته می‌شود.
    هر دو در ابتدا خاموش هستند.
  */

  const constraints =
    type === "video"
      ? {
          audio: true,
          video: {
            facingMode: "user"
          }
        }
      : {
          audio: true,
          video: false
        };


  const stream =
    await navigator.mediaDevices.getUserMedia(
      constraints
    );


  stream
    .getAudioTracks()
    .forEach(track => {

      track.enabled = false;

    });


  stream
    .getVideoTracks()
    .forEach(track => {

      track.enabled = false;

    });


  /*
    وضعیت اولیه دقیقاً خاموش
  */

  micEnabled = false;
  cameraEnabled = false;


  const localVideo =
    $("localVideo");


  if (localVideo) {

    localVideo.srcObject =
      stream;

  }


  updateCallButtonsUI();


  return stream;
}


/* =========================================================
   CREATE PEER CONNECTION
========================================================= */

function createPeerConnection(
  role
) {

  const pc =
    new RTCPeerConnection(
      rtcConfig
    );


  pc.ontrack = event => {

    if (!remoteStream) {

      remoteStream =
        new MediaStream();

    }


    event.streams[0]
      .getTracks()
      .forEach(track => {

        const alreadyExists =
          remoteStream
            .getTracks()
            .some(
              existing =>
                existing.id === track.id
            );


        if (!alreadyExists) {

          remoteStream.addTrack(
            track
          );

        }

      });


    const remoteVideo =
      $("remoteVideo");

    const remoteAudio =
      $("remoteAudio");


    if (remoteVideo) {

      remoteVideo.srcObject =
        remoteStream;

    }


    if (remoteAudio) {

      remoteAudio.srcObject =
        remoteStream;

      remoteAudio.muted =
        !speakerEnabled;

      remoteAudio.play()
        .catch(() => {});

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
        role === "caller"
          ? "callerCandidates"
          : "calleeCandidates";


      try {

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

      } catch (error) {

        console.error(
          "ICE CANDIDATE ERROR:",
          error
        );

      }

    };


  pc.onconnectionstatechange =
    () => {

      console.log(
        "WebRTC connection:",
        pc.connectionState
      );


      if (
        pc.connectionState ===
        "connected"
      ) {

        setCallStatus(
          "تماس برقرار است"
        );

        startCallTimer();

      }


      if (
        pc.connectionState ===
        "connecting"
      ) {

        setCallStatus(
          "در حال اتصال..."
        );

      }


      if (
        pc.connectionState ===
        "disconnected"
      ) {

        setCallStatus(
          "اتصال قطع شد..."
        );

      }


      if (
        pc.connectionState ===
        "failed"
      ) {

        showToast(
          "اتصال تماس برقرار نشد",
          "❌"
        );

        endCurrentCall(
          true
        );

      }


      if (
        pc.connectionState ===
        "closed"
      ) {

        stopCallTimer();

      }

    };


  pc.oniceconnectionstatechange =
    () => {

      console.log(
        "ICE:",
        pc.iceConnectionState
      );

    };


  return pc;
}


/* =========================================================
   CURRENT CALL LISTENER
========================================================= */

function setupCurrentCallListener() {

  if (
    !diaryId ||
    !currentCallId
  ) {
    return;
  }


  if (unsubscribeCurrentCall) {

    unsubscribeCurrentCall();

    unsubscribeCurrentCall =
      null;

  }


  const callRef =
    doc(
      db,
      "diaries",
      diaryId,
      "calls",
      currentCallId
    );


  unsubscribeCurrentCall =
    onSnapshot(
      callRef,
      async snapshot => {

        if (!snapshot.exists()) {
          return;
        }


        const call =
          snapshot.data();


        if (
          currentCallRole === "caller" &&
          call.answer &&
          peerConnection
        ) {

          try {

            const remoteDescription =
              peerConnection
                .remoteDescription;


            if (!remoteDescription) {

              await peerConnection
                .setRemoteDescription(
                  new RTCSessionDescription(
                    call.answer
                  )
                );


              setCallStatus(
                "در حال اتصال..."
              );

            }

          } catch (error) {

            console.error(
              "SET ANSWER ERROR:",
              error
            );

          }

        }


        if (
          call.status ===
          "rejected"
        ) {

          showToast(
            "تماس رد شد",
            "📞"
          );

          endCurrentCall(
            true
          );

        }


        if (
          call.status ===
          "ended"
        ) {

          endCurrentCall(
            true
          );

        }

      },
      error => {

        console.error(
          "CURRENT CALL ERROR:",
          error
        );

      }
    );
}


/* =========================================================
   CANDIDATE LISTENER
========================================================= */

function setupCandidateListener(
  collectionName
) {

  if (
    !diaryId ||
    !currentCallId
  ) {
    return;
  }


  if (unsubscribeCandidates) {

    unsubscribeCandidates();

    unsubscribeCandidates =
      null;

  }


  const candidatesRef =
    collection(
      db,
      "diaries",
      diaryId,
      "calls",
      currentCallId,
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


              if (
                !peerConnection
              ) {
                return;
              }


              try {

                await peerConnection
                  .addIceCandidate(
                    new RTCIceCandidate(
                      change.doc.data()
                    )
                  );

              } catch (error) {

                console.error(
                  "ADD ICE ERROR:",
                  error
                );

              }

            }
          );

      },
      error => {

        console.error(
          "CANDIDATES ERROR:",
          error
        );

      }
    );
}


/* =========================================================
   INCOMING CALLS
========================================================= */

function setupIncomingCalls() {

  if (
    !diaryId ||
    !currentUser
  ) {
    return;
  }


  if (unsubscribeIncomingCalls) {

    unsubscribeIncomingCalls();

    unsubscribeIncomingCalls =
      null;

  }


  /*
    فقط calleeUid را query می‌کنیم
    تا نیاز به Composite Index نباشد.

    status را داخل کد بررسی می‌کنیم.
  */

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


  unsubscribeIncomingCalls =
    onSnapshot(
      incomingQuery,
      snapshot => {

        let ringingCall =
          null;


        snapshot.forEach(
          item => {

            const data =
              item.data();


            if (
              data.status ===
              "ringing"
            ) {

              ringingCall = {
                id: item.id,
                ...data
              };

            }

          }
        );


        if (
          ringingCall &&
          !currentCallId
        ) {

          pendingIncomingCall =
            ringingCall;


          showIncomingCall(
            ringingCall
          );

        }

      },
      error => {

        console.error(
          "INCOMING CALL ERROR:",
          error
        );

      }
    );
}


/* =========================================================
   SHOW INCOMING CALL
========================================================= */

function showIncomingCall(
  call
) {

  const modal =
    $("incomingCallModal");


  if (!modal) {
    return;
  }


  const callerName =
    $("incomingCallerName");


  const callType =
    $("incomingCallType");


  if (callerName) {

    callerName.textContent =
      call.callerName ||
      "نفر دیگر";

  }


  if (callType) {

    callType.textContent =
      call.type === "video"
        ? "تماس تصویری"
        : "تماس صوتی";

  }


  modal.classList.remove(
    "hidden"
  );
}


/* =========================================================
   HIDE INCOMING CALL
========================================================= */

function hideIncomingCall() {

  const modal =
    $("incomingCallModal");


  if (modal) {

    modal.classList.add(
      "hidden"
    );

  }
}


/* =========================================================
   ACCEPT INCOMING CALL
========================================================= */

async function acceptIncomingCall() {

  const call =
    pendingIncomingCall;


  if (!call) {
    return;
  }


  hideIncomingCall();


  try {

    currentCallId =
      call.id;

    currentCallType =
      call.type;

    currentCallRole =
      "callee";


    /*
      تماس صوتی:
      میکروفون خاموش

      تماس تصویری:
      میکروفون + دوربین خاموش
    */

    micEnabled = false;
    cameraEnabled = false;
    speakerEnabled = true;


    localStream =
      await getLocalMedia(
        call.type
      );


    peerConnection =
      createPeerConnection(
        "callee"
      );


    localStream
      .getTracks()
      .forEach(track => {

        peerConnection.addTrack(
          track,
          localStream
        );

      });


    await peerConnection
      .setRemoteDescription(
        new RTCSessionDescription(
          call.offer
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
      doc(
        db,
        "diaries",
        diaryId,
        "calls",
        currentCallId
      ),
      {
        answer: {
          type: answer.type,
          sdp: answer.sdp
        },
        status: "accepted"
      }
    );


    setupCurrentCallListener();

    setupCandidateListener(
      "callerCandidates"
    );


    showCallScreen(
      call.callerName ||
      "نفر دیگر",
      call.type
    );


    setCallStatus(
      "در حال اتصال..."
    );


    updateCallButtonsUI();


    pendingIncomingCall =
      null;


  } catch (error) {

    console.error(
      "ACCEPT CALL ERROR:",
      error
    );


    showToast(
      getMediaErrorMessage(error),
      "❌"
    );


    await rejectCallById(
      call.id
    );


    cleanupCall();

  }
}


/* =========================================================
   REJECT INCOMING CALL
========================================================= */

async function rejectIncomingCall() {

  const call =
    pendingIncomingCall;


  hideIncomingCall();


  if (!call) {
    return;
  }


  try {

    await rejectCallById(
      call.id
    );


  } catch (error) {

    console.error(
      "REJECT CALL ERROR:",
      error
    );

  }


  pendingIncomingCall =
    null;
}


/* =========================================================
   REJECT CALL BY ID
========================================================= */

async function rejectCallById(
  callId
) {

  if (!callId || !diaryId) {
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
        status: "rejected"
      }
    );

  } catch (error) {

    console.error(
      "REJECT UPDATE ERROR:",
      error
    );

  }
}


/* =========================================================
   SHOW CALL SCREEN
========================================================= */

function showCallScreen(
  name,
  type
) {

  const screen =
    $("callScreen");


  if (!screen) {
    return;
  }


  screen.classList.remove(
    "hidden"
  );


  if ($("callTitle")) {

    $("callTitle").textContent =
      name ||
      "نفر دیگر";

  }


  setCallStatus(
    "در حال برقراری تماس..."
  );


  if ($("callTimer")) {

    $("callTimer").textContent =
      "00:00";

  }


  const label =
    document.querySelector(
      ".call-type-label"
    );


  if (label) {

    label.textContent =
      type === "video"
        ? "تماس تصویری"
        : "تماس صوتی";

  }


  const cameraBtn =
    $("cameraBtn");


  /*
    در تماس صوتی اصلاً دوربین نداریم.
  */

  if (cameraBtn) {

    cameraBtn.style.display =
      type === "video"
        ? "flex"
        : "none";

  }


  updateCallButtonsUI();
}


/* =========================================================
   CALL STATUS
========================================================= */

function setCallStatus(
  text
) {

  const status =
    $("callStatus");


  if (status) {
    status.textContent =
      text;
  }
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

    showToast(
      "میکروفون در دسترس نیست",
      "⚠️"
    );

    return;
  }


  micEnabled =
    !micEnabled;


  tracks.forEach(
    track => {

      track.enabled =
        micEnabled;

    }
  );


  updateCallButtonsUI();


  showToast(
    micEnabled
      ? "میکروفون روشن شد 🎙️"
      : "میکروفون خاموش شد 🔇",
    micEnabled
      ? "🎙️"
      : "🔇"
  );
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
      "دوربین در این تماس فعال نیست",
      "⚠️"
    );

    return;
  }


  cameraEnabled =
    !cameraEnabled;


  tracks.forEach(
    track => {

      track.enabled =
        cameraEnabled;

    }
  );


  updateCallButtonsUI();


  showToast(
    cameraEnabled
      ? "دوربین روشن شد 📷"
      : "دوربین خاموش شد 🚫",
    cameraEnabled
      ? "📷"
      : "🚫"
  );
}


/* =========================================================
   SPEAKER
========================================================= */

function toggleSpeaker() {

  speakerEnabled =
    !speakerEnabled;


  const remoteAudio =
    $("remoteAudio");


  const remoteVideo =
    $("remoteVideo");


  if (remoteAudio) {

    remoteAudio.muted =
      !speakerEnabled;

  }


  if (remoteVideo) {

    remoteVideo.muted =
      !speakerEnabled;

  }


  updateCallButtonsUI();


  showToast(
    speakerEnabled
      ? "صدای خروجی روشن شد 🔊"
      : "صدای خروجی خاموش شد 🔇",
    speakerEnabled
      ? "🔊"
      : "🔇"
  );
}


/* =========================================================
   CALL TIMER
========================================================= */

function startCallTimer() {

  if (callTimerInterval) {
    return;
  }


  callStartedAt =
    Date.now();


  callTimerInterval =
    setInterval(
      updateCallTimer,
      1000
    );


  updateCallTimer();
}


/* =========================================================
   UPDATE CALL TIMER
========================================================= */

function updateCallTimer() {

  if (!callStartedAt) {
    return;
  }


  const elapsed =
    Math.floor(
      (Date.now() - callStartedAt) /
      1000
    );


  const minutes =
    Math.floor(elapsed / 60)
      .toString()
      .padStart(2, "0");


  const seconds =
    (elapsed % 60)
      .toString()
      .padStart(2, "0");


  const timer =
    $("callTimer");


  if (timer) {

    timer.textContent =
      `${minutes}:${seconds}`;

  }
}


/* =========================================================
   STOP CALL TIMER
========================================================= */

function stopCallTimer() {

  if (callTimerInterval) {

    clearInterval(
      callTimerInterval
    );

    callTimerInterval =
      null;

  }


  callStartedAt =
    null;


  const timer =
    $("callTimer");


  if (timer) {

    timer.textContent =
      "00:00";

  }
}


/* =========================================================
   END CURRENT CALL
========================================================= */

async function endCurrentCall(
  silent = false
) {

  const callId =
    currentCallId;


  if (
    callId &&
    diaryId
  ) {

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
          status: "ended"
        }
      );

    } catch (error) {

      console.error(
        "END CALL FIRESTORE ERROR:",
        error
      );

    }

  }


  cleanupCall();


  if (!silent) {

    showToast(
      "تماس پایان یافت",
      "📞"
    );

  }
}


/* =========================================================
   CLEANUP CALL
========================================================= */

function cleanupCall() {

  stopCallTimer();


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

    try {
      peerConnection.close();
    } catch {}

    peerConnection =
      null;
  }


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


  if (remoteStream) {

    remoteStream
      .getTracks()
      .forEach(
        track => {

          track.stop();

        }
      );

    remoteStream =
      null;
  }


  const localVideo =
    $("localVideo");

  const remoteVideo =
    $("remoteVideo");

  const remoteAudio =
    $("remoteAudio");


  if (localVideo) {

    localVideo.srcObject =
      null;

  }


  if (remoteVideo) {

    remoteVideo.srcObject =
      null;

  }


  if (remoteAudio) {

    remoteAudio.srcObject =
      null;

  }


  currentCallId =
    null;

  currentCallType =
    null;

  currentCallRole =
    null;


  pendingIncomingCall =
    null;


  /*
    هر تماس جدید دوباره از حالت خاموش شروع می‌شود.
  */

  micEnabled = false;
  cameraEnabled = false;
  speakerEnabled = true;


  const screen =
    $("callScreen");


  if (screen) {

    screen.classList.add(
      "hidden"
    );

  }


  const cameraBtn =
    $("cameraBtn");


  if (cameraBtn) {

    cameraBtn.style.display =
      "flex";

  }


  updateCallButtonsUI();
}


/* =========================================================
   MEDIA ERROR MESSAGE
========================================================= */

function getMediaErrorMessage(
  error
) {

  if (!error) {
    return "دسترسی به میکروفون یا دوربین ممکن نشد";
  }


  if (
    error.name ===
    "NotAllowedError"
  ) {

    return "اجازه میکروفون یا دوربین داده نشده است";

  }


  if (
    error.name ===
    "NotFoundError"
  ) {

    return "میکروفون یا دوربین پیدا نشد";

  }


  if (
    error.name ===
    "NotReadableError"
  ) {

    return "میکروفون یا دوربین توسط برنامه دیگری استفاده می‌شود";

  }


  if (
    error.name ===
    "SecurityError"
  ) {

    return "سایت باید با HTTPS باز شود";

  }


  return "دسترسی به میکروفون یا دوربین ممکن نشد";
}


/* =========================================================
   CLEANUP SUBSCRIPTIONS
========================================================= */

function cleanupSubscriptions() {

  if (unsubscribeMembers) {

    unsubscribeMembers();

    unsubscribeMembers =
      null;

  }


  if (unsubscribeMessages) {

    unsubscribeMessages();

    unsubscribeMessages =
      null;

  }


  if (unsubscribePresence) {

    unsubscribePresence();

    unsubscribePresence =
      null;

  }


  if (unsubscribeBattery) {

    unsubscribeBattery();

    unsubscribeBattery =
      null;

  }


  if (unsubscribeIncomingCalls) {

    unsubscribeIncomingCalls();

    unsubscribeIncomingCalls =
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
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

  try {

    if (currentCallId) {
      await endCurrentCall(true);
    }


    cleanupSubscriptions();


    if (
      currentUser &&
      diaryId
    ) {

      try {

        await update(
          ref(
            rtdb,
            `diaries/${diaryId}/presence/${currentUser.uid}`
          ),
          {
            online: false,
            lastSeen:
              rtdbServerTimestamp()
          }
        );

      } catch {}

    }


    await signOut(auth);


    currentUser = null;

    diaryId = "";

    currentName = "";

    members = [];

    otherMember = null;


    localStorage.removeItem(
      "sharedDiaryCode"
    );

    localStorage.removeItem(
      "sharedDiaryName"
    );


    const appScreen =
      $("appScreen");

    const loginScreen =
      $("loginScreen");


    if (appScreen) {

      appScreen.classList.add(
        "hidden"
      );

    }


    if (loginScreen) {

      loginScreen.classList.remove(
        "hidden"
      );

    }


    const codeInput =
      $("diaryCode");

    const nameInput =
      $("userName");


    if (codeInput) {
      codeInput.value = "";
    }

    if (nameInput) {
      nameInput.value = "";
    }


    showToast(
      "از دفترچه خارج شدید",
      "✓"
    );


  } catch (error) {

    console.error(
      "LOGOUT ERROR:",
      error
    );

  }
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
   AUTO LOGIN FROM STORAGE
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
    !savedCode ||
    !savedName
  ) {
    return;
  }


  try {

    if (!currentUser) {

      await signInAnonymously(
        auth
      );

    }


    currentUser =
      auth.currentUser;


    if (!currentUser) {
      return;
    }


    diaryId =
      savedCode;

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


    const snapshot =
      await getDoc(
        memberRef
      );


    if (!snapshot.exists()) {

      await setDoc(
        memberRef,
        {
          uid: currentUser.uid,
          name: currentName,
          createdAt:
            serverTimestamp(),
          lastSeen:
            serverTimestamp()
        }
      );

    } else {

      await updateDoc(
        memberRef,
        {
          name: currentName,
          lastSeen:
            serverTimestamp()
        }
      );

    }


    openApp();

    await setupEverything();


  } catch (error) {

    console.error(
      "RESTORE SESSION ERROR:",
      error
    );


    localStorage.removeItem(
      "sharedDiaryCode"
    );

    localStorage.removeItem(
      "sharedDiaryName"
    );

  }
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const loginBtn =
      $("loginBtn");


    if (loginBtn) {

      loginBtn.addEventListener(
        "click",
        login
      );

    }


    const logoutBtn =
      $("logoutBtn");


    if (logoutBtn) {

      logoutBtn.addEventListener(
        "click",
        logout
      );

    }


    const codeInput =
      $("diaryCode");

    const nameInput =
      $("userName");


    [codeInput, nameInput]
      .forEach(input => {

        if (!input) {
          return;
        }


        input.addEventListener(
          "keydown",
          event => {

            if (
              event.key ===
              "Enter"
            ) {

              login();

            }

          }
        );

      });


    setupCallButtons();

    setupTheme();

    setupNavigation();

    setupChat();

    restoreSession();

  }
);