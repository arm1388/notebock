// ============================================================
// shared-diary — script.js
// ============================================================

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
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getDatabase,
  ref,
  set,
  update,
  onValue,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";


// ============================================================
// FIREBASE CONFIG
// ============================================================

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


// ============================================================
// FIREBASE INIT
// ============================================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const realtimeDB = getDatabase(app);


// ============================================================
// FIXED DIARY
// این کد فقط داخل JavaScript است و در UI نمایش داده نمی‌شود.
// ============================================================

const FIXED_DIARY_CODE = "asna&amir8890";

let diaryId = FIXED_DIARY_CODE;


// ============================================================
// GLOBAL STATE
// ============================================================

let currentUser = null;
let currentUserName = "";
let otherMember = null;

let unsubscribeMessages = null;
let unsubscribeMembers = null;
let unsubscribePartnerPresence = null;

let batteryManager = null;

let localStream = null;
let remoteStream = null;
let peerConnection = null;

let currentCallId = null;
let currentCallType = null;
let currentCallRole = null;

let unsubscribeCall = null;
let unsubscribeCallerCandidates = null;
let unsubscribeCalleeCandidates = null;

let callStartTime = null;
let callTimerInterval = null;

let pendingIncomingCall = null;

const ICE_SERVERS = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    },
    {
      urls: "stun:stun1.l.google.com:19302"
    }
  ]
};


// ============================================================
// DOM HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

function show(element) {
  if (element) {
    element.classList.remove("hidden");
  }
}

function hide(element) {
  if (element) {
    element.classList.add("hidden");
  }
}

function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent = value ?? "";
  }
}


// ============================================================
// TOAST
// ============================================================

let toastTimer = null;

function showToast(message) {
  const toast = $("toast");
  const toastText = $("toastText");

  if (!toast || !toastText) return;

  toastText.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}


// ============================================================
// LOCAL STORAGE
// ============================================================

function saveLocalUser() {
  localStorage.setItem(
    "sharedDiaryUser",
    JSON.stringify({
      name: currentUserName,
      diaryId: FIXED_DIARY_CODE
    })
  );
}

function getLocalUser() {
  try {
    return JSON.parse(
      localStorage.getItem("sharedDiaryUser")
    );
  } catch {
    return null;
  }
}

function clearLocalUser() {
  localStorage.removeItem("sharedDiaryUser");
}


// ============================================================
// LOGIN
// ============================================================

function setupLogin() {
  const loginBtn = $("loginBtn");
  const userNameInput = $("userName");

  if (!loginBtn || !userNameInput) return;

  loginBtn.addEventListener("click", login);

  userNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      login();
    }
  });
}

async function login() {
  const input = $("userName");

  if (!input) return;

  const name = input.value.trim();

  if (!name) {
    showToast("لطفاً نام خودت را وارد کن");
    input.focus();
    return;
  }

  if (name.length > 40) {
    showToast("نام خیلی طولانی است");
    return;
  }

  currentUserName = name;

  const loginBtn = $("loginBtn");

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.textContent = "در حال ورود...";
  }

  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    saveLocalUser();

  } catch (error) {
    console.error("Login error:", error);

    showToast("ورود انجام نشد");

    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = "ورود به دفترچه";
    }
  }
}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(auth, async (user) => {

  currentUser = user;

  if (!user) {
    showLoginScreen();
    return;
  }

  const localUser = getLocalUser();

  if (!currentUserName && localUser?.name) {
    currentUserName = localUser.name;
  }

  if (!currentUserName) {
    showLoginScreen();
    return;
  }

  try {
    await enterDiary();
  } catch (error) {
    console.error(error);

    showToast(
      "ورود به دفترچه انجام نشد"
    );

    showLoginScreen();
  }
});


// ============================================================
// ENTER DIARY
// ============================================================

async function enterDiary() {

  if (!currentUser) {
    return;
  }

  const memberRef = doc(
    db,
    "diaries",
    diaryId,
    "members",
    currentUser.uid
  );

  const memberSnapshot = await getDoc(memberRef);

  if (!memberSnapshot.exists()) {

    const membersSnapshot = await getDocs(
      collection(
        db,
        "diaries",
        diaryId,
        "members"
      )
    );

    if (membersSnapshot.size >= 2) {
      showToast(
        "این دفترچه قبلاً دو عضو دارد"
      );

      await signOut(auth);

      return;
    }

    await setDoc(memberRef, {
      uid: currentUser.uid,
      name: currentUserName,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    });

  } else {

    const oldData = memberSnapshot.data();

    if (
      oldData.name &&
      !currentUserName
    ) {
      currentUserName = oldData.name;
    }

    await updateDoc(memberRef, {
      name: currentUserName,
      lastSeen: serverTimestamp()
    });
  }

  saveLocalUser();

  showAppScreen();

  setupEverything();
}


// ============================================================
// SHOW SCREENS
// ============================================================

function showLoginScreen() {

  const loginScreen = $("loginScreen");
  const appScreen = $("appScreen");

  show(loginScreen);
  hide(appScreen);

  const input = $("userName");

  if (input && !currentUserName) {
    input.value = "";
  }
}

function showAppScreen() {

  const loginScreen = $("loginScreen");
  const appScreen = $("appScreen");

  hide(loginScreen);
  show(appScreen);

  setText("settingsName", currentUserName);
  setText("myName", currentUserName);
}


// ============================================================
// MAIN SETUP
// ============================================================

let appInitialized = false;

function setupEverything() {

  if (appInitialized) {
    refreshMemberDependentUI();
    return;
  }

  appInitialized = true;

  setupNavigation();
  setupTheme();
  setupChat();
  setupCallButtons();
  setupSettings();
  setupMembers();
  setupPresence();
  setupBattery();

  refreshMemberDependentUI();
}


// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {

  const navItems = document.querySelectorAll(
    ".nav-item[data-page]"
  );

  navItems.forEach((item) => {

    item.addEventListener("click", () => {

      const pageId = item.dataset.page;

      if (!pageId) return;

      openPage(pageId);

      navItems.forEach((nav) => {
        nav.classList.toggle(
          "active",
          nav === item
        );
      });
    });
  });

  document
    .querySelectorAll("[data-page]")
    .forEach((element) => {

      if (
        element.classList.contains("nav-item")
      ) {
        return;
      }

      element.addEventListener("click", () => {

        const pageId = element.dataset.page;

        if (pageId) {
          openPage(pageId);

          navItems.forEach((nav) => {
            nav.classList.toggle(
              "active",
              nav.dataset.page === pageId
            );
          });
        }
      });
    });
}

function openPage(pageId) {

  const pages = document.querySelectorAll(
    ".page"
  );

  pages.forEach((page) => {
    page.classList.remove("active");
  });

  const target = $(pageId);

  if (target) {
    target.classList.add("active");
  }
}


// ============================================================
// THEME
// ============================================================

function setupTheme() {

  const themeToggle = $("themeToggle");
  const darkModeToggle = $("darkModeToggle");

  const savedTheme =
    localStorage.getItem("diaryTheme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  }

  updateThemeControls();

  if (themeToggle) {

    themeToggle.addEventListener(
      "click",
      toggleTheme
    );
  }

  if (darkModeToggle) {

    darkModeToggle.addEventListener(
      "change",
      () => {
        setDarkMode(
          darkModeToggle.checked
        );
      }
    );
  }
}

function toggleTheme() {

  const dark =
    !document.body.classList.contains("dark");

  setDarkMode(dark);
}

function setDarkMode(enabled) {

  document.body.classList.toggle(
    "dark",
    enabled
  );

  localStorage.setItem(
    "diaryTheme",
    enabled ? "dark" : "light"
  );

  updateThemeControls();
}

function updateThemeControls() {

  const toggle = $("darkModeToggle");

  if (toggle) {
    toggle.checked =
      document.body.classList.contains("dark");
  }
}


// ============================================================
// MEMBERS
// ============================================================

function setupMembers() {

  if (unsubscribeMembers) {
    unsubscribeMembers();
  }

  const membersRef = collection(
    db,
    "diaries",
    diaryId,
    "members"
  );

  unsubscribeMembers = onSnapshot(
    membersRef,
    (snapshot) => {

      const members = [];

      snapshot.forEach((item) => {
        members.push({
          id: item.id,
          ...item.data()
        });
      });

      const me = members.find(
        (member) =>
          member.uid === currentUser?.uid
      );

      otherMember =
        members.find(
          (member) =>
            member.uid !== currentUser?.uid
        ) || null;

      if (me?.name) {
        currentUserName = me.name;
      }

      setText(
        "myName",
        currentUserName
      );

      setText(
        "settingsName",
        currentUserName
      );

      updatePartnerUI();

      if (otherMember) {

        subscribePartnerPresence();
        updatePartnerBatteryFromPresence();

      } else {

        setText(
          "otherName",
          "منتظر نفر دیگر..."
        );

        setText(
          "chatPartnerName",
          "نفر دیگر"
        );

        setText(
          "chatOnlineStatus",
          "منتظر ورود..."
        );
      }

    },
    (error) => {
      console.error(
        "Members listener error:",
        error
      );
    }
  );
}


// ============================================================
// PARTNER UI
// ============================================================

function refreshMemberDependentUI() {

  if (otherMember) {
    updatePartnerUI();
  }
}

function updatePartnerUI() {

  if (!otherMember) {
    return;
  }

  setText(
    "otherName",
    otherMember.name || "نفر دیگر"
  );

  setText(
    "chatPartnerName",
    otherMember.name || "نفر دیگر"
  );
}


// ============================================================
// PRESENCE
// ============================================================

async function setupPresence() {

  if (!currentUser) {
    return;
  }

  const myPresenceRef = ref(
    realtimeDB,
    `diaries/${diaryId}/presence/${currentUser.uid}`
  );

  try {

    await set(myPresenceRef, {
      uid: currentUser.uid,
      name: currentUserName,
      online: true,
      battery: null,
      charging: false,
      updatedAt: Date.now()
    });

    await onDisconnect(myPresenceRef).update({
      online: false,
      updatedAt: Date.now()
    });

  } catch (error) {
    console.error(
      "Presence error:",
      error
    );
  }

  subscribePartnerPresence();
}

function subscribePartnerPresence() {

  if (!otherMember) {
    return;
  }

  if (unsubscribePartnerPresence) {
    unsubscribePartnerPresence();
    unsubscribePartnerPresence = null;
  }

  const partnerRef = ref(
    realtimeDB,
    `diaries/${diaryId}/presence/${otherMember.uid}`
  );

  unsubscribePartnerPresence =
    onValue(
      partnerRef,
      (snapshot) => {

        const data = snapshot.val();

        if (!data) {

          setText(
            "chatOnlineStatus",
            "آفلاین"
          );

          setText(
            "otherBatteryText",
            "--"
          );

          updateBatteryFill(
            "otherBatteryFill",
            0
          );

          return;
        }

        setText(
          "chatOnlineStatus",
          data.online
            ? "آنلاین"
            : "آخرین حضور ثبت شده"
        );

        updatePartnerBattery(
          data.battery,
          data.charging
        );
      },
      (error) => {
        console.error(
          "Partner presence error:",
          error
        );
      }
    );
}


// ============================================================
// BATTERY
// ============================================================

async function setupBattery() {

  if (!currentUser) {
    return;
  }

  if (
    "getBattery" in navigator
  ) {

    try {

      batteryManager =
        await navigator.getBattery();

      updateMyBattery();

      batteryManager.addEventListener(
        "levelchange",
        updateMyBattery
      );

      batteryManager.addEventListener(
        "chargingchange",
        updateMyBattery
      );

    } catch (error) {
      console.warn(
        "Battery API unavailable:",
        error
      );

      setText(
        "myBatteryText",
        "--"
      );
    }

  } else {

    setText(
      "myBatteryText",
      "--"
    );

    updateBatteryFill(
      "myBatteryFill",
      0
    );
  }
}

async function updateMyBattery() {

  if (
    !batteryManager ||
    !currentUser
  ) {
    return;
  }

  const level =
    Math.round(
      batteryManager.level * 100
    );

  const charging =
    Boolean(
      batteryManager.charging
    );

  setText(
    "myBatteryText",
    `${level}%`
  );

  setText(
    "myCharging",
    charging ? "⚡" : ""
  );

  updateBatteryFill(
    "myBatteryFill",
    level
  );

  const presenceRef = ref(
    realtimeDB,
    `diaries/${diaryId}/presence/${currentUser.uid}`
  );

  try {

    await update(
      presenceRef,
      {
        uid: currentUser.uid,
        name: currentUserName,
        online: true,
        battery: level,
        charging,
        updatedAt: Date.now()
      }
    );

  } catch (error) {
    console.error(
      "Battery sync error:",
      error
    );
  }
}

function updatePartnerBattery(
  battery,
  charging
) {

  if (
    typeof battery !== "number"
  ) {
    setText(
      "otherBatteryText",
      "--"
    );

    setText(
      "otherCharging",
      ""
    );

    updateBatteryFill(
      "otherBatteryFill",
      0
    );

    return;
  }

  setText(
    "otherBatteryText",
    `${Math.round(battery)}%`
  );

  setText(
    "otherCharging",
    charging ? "⚡" : ""
  );

  updateBatteryFill(
    "otherBatteryFill",
    battery
  );
}

function updatePartnerBatteryFromPresence() {

  if (!otherMember) {
    return;
  }

  subscribePartnerPresence();
}

function updateBatteryFill(
  elementId,
  percent
) {

  const element = $(elementId);

  if (!element) {
    return;
  }

  const safe =
    Math.max(
      0,
      Math.min(
        100,
        Number(percent) || 0
      )
    );

  element.style.width =
    `${safe}%`;
}


// ============================================================
// CHAT
// ============================================================

function setupChat() {

  const sendButton =
    $("sendMessageBtn");

  const input =
    $("messageInput");

  if (!sendButton || !input) {
    return;
  }

  sendButton.addEventListener(
    "click",
    sendMessage
  );

  input.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendMessage();
      }
    }
  );

  listenForMessages();
}

function listenForMessages() {

  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
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
      orderBy("createdAt", "asc")
    );

  unsubscribeMessages =
    onSnapshot(
      messagesQuery,
      (snapshot) => {

        renderMessages(
          snapshot.docs
        );

        updateStats(
          snapshot.docs
        );

      },
      (error) => {

        console.error(
          "Messages listener error:",
          error
        );

        showToast(
          "دریافت پیام‌ها با خطا مواجه شد"
        );
      }
    );
}

async function sendMessage() {

  if (!currentUser) {
    showToast("ابتدا وارد شو");
    return;
  }

  const input =
    $("messageInput");

  const sendButton =
    $("sendMessageBtn");

  if (!input) {
    return;
  }

  const text =
    input.value.trim();

  if (!text) {
    return;
  }

  if (text.length > 5000) {
    showToast(
      "پیام خیلی طولانی است"
    );
    return;
  }

  if (sendButton) {
    sendButton.disabled = true;
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
        senderName: currentUserName,
        text,
        createdAt: serverTimestamp(),
        clientCreatedAt: Date.now()
      }
    );

    input.value = "";

    input.focus();

  } catch (error) {

    console.error(
      "Send message error:",
      error
    );

    showToast(
      "ارسال پیام انجام نشد"
    );

  } finally {

    if (sendButton) {
      sendButton.disabled = false;
    }
  }
}


// ============================================================
// RENDER MESSAGES
// ============================================================

function renderMessages(docs) {

  const container =
    $("messages");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!docs.length) {

    const empty =
      document.createElement("div");

    empty.className =
      "messages-empty";

    empty.textContent =
      "هنوز پیامی نوشته نشده...";

    container.appendChild(empty);

    return;
  }

  docs.forEach((messageDoc) => {

    const data =
      messageDoc.data();

    const mine =
      data.senderUid === currentUser?.uid;

    const message =
      document.createElement("div");

    message.className =
      `message ${mine ? "mine" : "other"}`;

    const content =
      document.createElement("div");

    content.className =
      "message-content";

    const text =
      document.createElement("div");

    text.className =
      "message-text";

    text.textContent =
      data.text || "";

    const meta =
      document.createElement("div");

    meta.className =
      "message-meta";

    const name =
      document.createElement("span");

    name.textContent =
      mine
        ? "من"
        : (data.senderName || "نفر دیگر");

    const time =
      document.createElement("span");

    time.textContent =
      formatMessageTime(data);

    meta.appendChild(name);
    meta.appendChild(time);

    content.appendChild(text);
    content.appendChild(meta);

    message.appendChild(content);

    container.appendChild(message);
  });

  requestAnimationFrame(() => {

    container.scrollTop =
      container.scrollHeight;

  });
}


// ============================================================
// MESSAGE TIME
// ============================================================

function formatMessageTime(data) {

  let date = null;

  if (
    data.createdAt &&
    typeof data.createdAt.toDate === "function"
  ) {

    date =
      data.createdAt.toDate();

  } else if (
    typeof data.clientCreatedAt === "number"
  ) {

    date =
      new Date(
        data.clientCreatedAt
      );
  }

  if (!date) {
    return "...";
  }

  return date.toLocaleTimeString(
    "fa-IR",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


// ============================================================
// STATS
// ============================================================

function updateStats(docs) {

  setText(
    "memoryCount",
    docs.length
  );

  let favorites = 0;
  const days = new Set();

  docs.forEach((messageDoc) => {

    const data =
      messageDoc.data();

    if (data.favorite === true) {
      favorites++;
    }

    let date = null;

    if (
      data.createdAt &&
      typeof data.createdAt.toDate === "function"
    ) {
      date = data.createdAt.toDate();
    }

    if (
      !date &&
      typeof data.clientCreatedAt === "number"
    ) {
      date =
        new Date(
          data.clientCreatedAt
        );
    }

    if (date) {

      days.add(
        date.toLocaleDateString(
          "fa-IR"
        )
      );
    }
  });

  setText(
    "favoriteCount",
    favorites
  );

  setText(
    "daysCount",
    days.size
  );
}


// ============================================================
// SETTINGS
// ============================================================

function setupSettings() {

  const logoutBtn =
    $("logoutBtn");

  if (!logoutBtn) {
    return;
  }

  logoutBtn.addEventListener(
    "click",
    logout
  );
}

async function logout() {

  try {

    if (currentUser) {

      const presenceRef = ref(
        realtimeDB,
        `diaries/${diaryId}/presence/${currentUser.uid}`
      );

      await update(
        presenceRef,
        {
          online: false,
          updatedAt: Date.now()
        }
      );
    }

    await signOut(auth);

    clearLocalUser();

    currentUserName = "";
    currentUser = null;
    otherMember = null;

    showLoginScreen();

    showToast(
      "از دفترچه خارج شدی"
    );

  } catch (error) {

    console.error(
      "Logout error:",
      error
    );

    showToast(
      "خروج انجام نشد"
    );
  }
}


// ============================================================
// CALL BUTTONS
// ============================================================

function setupCallButtons() {

  const audioCallBtn =
    $("audioCallBtn");

  const videoCallBtn =
    $("videoCallBtn");

  const acceptCallBtn =
    $("acceptCallBtn");

  const rejectCallBtn =
    $("rejectCallBtn");

  const micBtn =
    $("micBtn");

  const cameraBtn =
    $("cameraBtn");

  const speakerBtn =
    $("speakerBtn");

  const endCallBtn =
    $("endCallBtn");

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
    rejectCallBtn.onclick =
      rejectIncomingCall;
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

  if (endCallBtn) {
    endCallBtn.onclick =
      endCurrentCall;
  }

  listenForIncomingCalls();
}


// ============================================================
// INCOMING CALL LISTENER
// ============================================================

let unsubscribeIncomingCalls = null;

function listenForIncomingCalls() {

  if (!currentUser) {
    return;
  }

  if (unsubscribeIncomingCalls) {
    unsubscribeIncomingCalls();
  }

  const callsRef =
    collection(
      db,
      "diaries",
      diaryId,
      "calls"
    );

  unsubscribeIncomingCalls =
    onSnapshot(
      callsRef,
      (snapshot) => {

        let incoming = null;

        snapshot.forEach((callDoc) => {

          const data =
            callDoc.data();

          if (
            data.calleeUid === currentUser.uid &&
            data.status === "ringing"
          ) {

            incoming = {
              id: callDoc.id,
              ...data
            };
          }
        });

        if (
          incoming &&
          !currentCallId
        ) {

          showIncomingCall(
            incoming
          );
        }
      },
      (error) => {
        console.error(
          "Incoming calls error:",
          error
        );
      }
    );
}


// ============================================================
// OUTGOING CALL
// ============================================================

async function startOutgoingCall(type) {

  if (!currentUser) {
    showToast("ابتدا وارد شو");
    return;
  }

  if (!otherMember) {
    showToast(
      "هنوز نفر دیگر وارد دفترچه نشده"
    );
    return;
  }

  if (currentCallId) {
    return;
  }

  currentCallType = type;
  currentCallRole = "caller";

  try {

    await createLocalMedia(type);

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
          callerName: currentUserName,
          calleeUid: otherMember.uid,
          type,
          status: "ringing",
          createdAt: serverTimestamp()
        }
      );

    currentCallId =
      callRef.id;

    showCallScreen(
      `${otherMember.name || "نفر دیگر"}`,
      "در حال برقراری تماس..."
    );

    await createCallerPeerConnection();

    subscribeToCallDocument();

    startCallTimer();

  } catch (error) {

    console.error(
      "Start call error:",
      error
    );

    showToast(
      "برقراری تماس انجام نشد"
    );

    await cleanupCall();
  }
}


// ============================================================
// LOCAL MEDIA
// ============================================================

async function createLocalMedia(type) {

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
    await navigator.mediaDevices.getUserMedia(
      constraints
    );

  const localVideo =
    $("localVideo");

  if (
    localVideo &&
    type === "video"
  ) {

    localVideo.srcObject =
      localStream;

    localVideo.muted = true;
    localVideo.playsInline = true;

    try {
      await localVideo.play();
    } catch {}
  }
}


// ============================================================
// CALLER PEER
// ============================================================

async function createCallerPeerConnection() {

  peerConnection =
    new RTCPeerConnection(
      ICE_SERVERS
    );

  setupRemoteStream();

  localStream
    ?.getTracks()
    .forEach((track) => {

      peerConnection.addTrack(
        track,
        localStream
      );
    });

  peerConnection.onicecandidate =
    async (event) => {

      if (
        !event.candidate ||
        !currentCallId
      ) {
        return;
      }

      await addCandidate(
        "callerCandidates",
        event.candidate
      );
    };

  peerConnection.onconnectionstatechange =
    handleConnectionState;

  const offer =
    await peerConnection.createOffer();

  await peerConnection.setLocalDescription(
    offer
  );

  await update(
    callDocumentRef(),
    {
      offer: {
        type: offer.type,
        sdp: offer.sdp
      }
    }
  );
}


// ============================================================
// CALL DOCUMENT LISTENER
// ============================================================

function subscribeToCallDocument() {

  if (unsubscribeCall) {
    unsubscribeCall();
  }

  unsubscribeCall =
    onSnapshot(
      callDocumentRef(),
      async (snapshot) => {

        if (!snapshot.exists()) {
          return;
        }

        const data =
          snapshot.data();

        if (
          currentCallRole === "caller" &&
          data.answer &&
          peerConnection
        ) {

          if (
            !peerConnection.currentRemoteDescription
          ) {

            try {

              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(
                  data.answer
                )
              );

            } catch (error) {
              console.error(
                "Set answer error:",
                error
              );
            }
          }
        }

        if (
          data.status === "ended" ||
          data.status === "rejected"
        ) {

          showToast(
            data.status === "rejected"
              ? "تماس رد شد"
              : "تماس پایان یافت"
          );

          await cleanupCall();
        }
      }
    );
}


// ============================================================
// INCOMING CALL UI
// ============================================================

function showIncomingCall(call) {

  pendingIncomingCall = call;

  setText(
    "incomingCallerName",
    call.callerName || "نفر دیگر"
  );

  setText(
    "incomingCallType",
    call.type === "video"
      ? "تماس تصویری"
      : "تماس صوتی"
  );

  show(
    $("incomingCallModal")
  );
}


// ============================================================
// ACCEPT INCOMING CALL
// ============================================================

async function acceptIncomingCall() {

  const call =
    pendingIncomingCall;

  if (!call) {
    return;
  }

  hide(
    $("incomingCallModal")
  );

  pendingIncomingCall = null;

  currentCallId =
    call.id;

  currentCallType =
    call.type;

  currentCallRole =
    "callee";

  try {

    await createLocalMedia(
      call.type
    );

    showCallScreen(
      call.callerName || "نفر دیگر",
      "در حال اتصال..."
    );

    await createCalleePeerConnection(
      call
    );

    subscribeToCallDocument();

    startCallTimer();

  } catch (error) {

    console.error(
      "Accept call error:",
      error
    );

    showToast(
      "اتصال به تماس انجام نشد"
    );

    await cleanupCall();
  }
}


// ============================================================
// CALLEE PEER
// ============================================================

async function createCalleePeerConnection(call) {

  peerConnection =
    new RTCPeerConnection(
      ICE_SERVERS
    );

  setupRemoteStream();

  localStream
    ?.getTracks()
    .forEach((track) => {

      peerConnection.addTrack(
        track,
        localStream
      );
    });

  peerConnection.onicecandidate =
    async (event) => {

      if (
        !event.candidate ||
        !currentCallId
      ) {
        return;
      }

      await addCandidate(
        "calleeCandidates",
        event.candidate
      );
    };

  peerConnection.onconnectionstatechange =
    handleConnectionState;

  const data =
    await getDoc(
      callDocumentRef()
    );

  if (!data.exists()) {
    throw new Error(
      "Call does not exist"
    );
  }

  const callData =
    data.data();

  if (!callData.offer) {
    throw new Error(
      "Offer not found"
    );
  }

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(
      callData.offer
    )
  );

  const answer =
    await peerConnection.createAnswer();

  await peerConnection.setLocalDescription(
    answer
  );

  await update(
    callDocumentRef(),
    {
      answer: {
        type: answer.type,
        sdp: answer.sdp
      },
      status: "accepted"
    }
  );

  await subscribeToCallerCandidates();
}


// ============================================================
// CANDIDATES
// ============================================================

async function addCandidate(
  collectionName,
  candidate
) {

  if (!currentCallId) {
    return;
  }

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
      candidate.toJSON()
    );

  } catch (error) {

    console.error(
      "Candidate error:",
      error
    );
  }
}

async function subscribeToCallerCandidates() {

  if (
    !currentCallId ||
    !peerConnection
  ) {
    return;
  }

  const candidatesRef =
    collection(
      db,
      "diaries",
      diaryId,
      "calls",
      currentCallId,
      "callerCandidates"
    );

  unsubscribeCallerCandidates =
    onSnapshot(
      candidatesRef,
      (snapshot) => {

        snapshot.docChanges()
          .forEach(
            async (change) => {

              if (
                change.type !== "added"
              ) {
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
                  "Add caller candidate error:",
                  error
                );
              }
            }
          );
      }
    );
}

async function subscribeToCalleeCandidates() {

  if (
    !currentCallId ||
    !peerConnection
  ) {
    return;
  }

  const candidatesRef =
    collection(
      db,
      "diaries",
      diaryId,
      "calls",
      currentCallId,
      "calleeCandidates"
    );

  unsubscribeCalleeCandidates =
    onSnapshot(
      candidatesRef,
      (snapshot) => {

        snapshot.docChanges()
          .forEach(
            async (change) => {

              if (
                change.type !== "added"
              ) {
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
                  "Add callee candidate error:",
                  error
                );
              }
            }
          );
      }
    );
}


// ============================================================
// REMOTE STREAM
// ============================================================

function setupRemoteStream() {

  remoteStream =
    new MediaStream();

  const remoteVideo =
    $("remoteVideo");

  const remoteAudio =
    $("remoteAudio");

  if (remoteVideo) {

    remoteVideo.srcObject =
      remoteStream;

    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;
  }

  if (remoteAudio) {

    remoteAudio.srcObject =
      remoteStream;

    remoteAudio.autoplay = true;
  }

  if (peerConnection) {

    peerConnection.ontrack =
      (event) => {

        event.streams[0]
          ?.getTracks()
          .forEach((track) => {

            remoteStream.addTrack(
              track
            );
          });

        if (remoteVideo) {
          remoteVideo.srcObject =
            remoteStream;
        }

        if (remoteAudio) {
          remoteAudio.srcObject =
            remoteStream;
        }
      };
  }
}


// ============================================================
// CALL CONNECTION STATE
// ============================================================

function handleConnectionState() {

  if (!peerConnection) {
    return;
  }

  const state =
    peerConnection.connectionState;

  if (state === "connected") {

    setText(
      "callStatus",
      "متصل"
    );

  } else if (
    state === "connecting"
  ) {

    setText(
      "callStatus",
      "در حال اتصال..."
    );

  } else if (
    state === "disconnected"
  ) {

    setText(
      "callStatus",
      "اتصال قطع شد"
    );

  } else if (
    state === "failed"
  ) {

    showToast(
      "اتصال تماس برقرار نشد"
    );

    cleanupCall();
  }
}


// ============================================================
// CALL SCREEN
// ============================================================

function showCallScreen(
  title,
  status
) {

  setText(
    "callTitle",
    title
  );

  setText(
    "callStatus",
    status
  );

  setText(
    "callTimer",
    "00:00"
  );

  show(
    $("callScreen")
  );
}


// ============================================================
// CALL TIMER
// ============================================================

function startCallTimer() {

  clearInterval(
    callTimerInterval
  );

  callStartTime =
    Date.now();

  callTimerInterval =
    setInterval(() => {

      if (!callStartTime) {
        return;
      }

      const seconds =
        Math.floor(
          (
            Date.now() -
            callStartTime
          ) / 1000
        );

      const minutes =
        Math.floor(
          seconds / 60
        );

      const remaining =
        seconds % 60;

      setText(
        "callTimer",
        `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
      );

    }, 1000);
}


// ============================================================
// CALL CONTROLS
// ============================================================

function toggleMicrophone() {

  if (!localStream) {
    return;
  }

  const tracks =
    localStream.getAudioTracks();

  if (!tracks.length) {
    return;
  }

  const enabled =
    !tracks[0].enabled;

  tracks.forEach(
    (track) => {
      track.enabled = enabled;
    }
  );

  const button =
    $("micBtn");

  if (button) {
    button.classList.toggle(
      "off",
      !enabled
    );
  }
}

function toggleCamera() {

  if (!localStream) {
    return;
  }

  const tracks =
    localStream.getVideoTracks();

  if (!tracks.length) {
    showToast(
      "این تماس تصویری نیست"
    );
    return;
  }

  const enabled =
    !tracks[0].enabled;

  tracks.forEach(
    (track) => {
      track.enabled = enabled;
    }
  );

  const button =
    $("cameraBtn");

  if (button) {
    button.classList.toggle(
      "off",
      !enabled
    );
  }
}

function toggleSpeaker() {

  const remoteAudio =
    $("remoteAudio");

  const remoteVideo =
    $("remoteVideo");

  const button =
    $("speakerBtn");

  const current =
    remoteAudio
      ? !remoteAudio.muted
      : true;

  const next =
    !current;

  if (remoteAudio) {
    remoteAudio.muted =
      !next;
  }

  if (remoteVideo) {
    remoteVideo.muted =
      !next;
  }

  if (button) {
    button.classList.toggle(
      "off",
      !next
    );
  }
}


// ============================================================
// REJECT CALL
// ============================================================

async function rejectIncomingCall() {

  const call =
    pendingIncomingCall;

  hide(
    $("incomingCallModal")
  );

  pendingIncomingCall = null;

  if (!call) {
    return;
  }

  try {

    await update(
      doc(
        db,
        "diaries",
        diaryId,
        "calls",
        call.id
      ),
      {
        status: "rejected",
        endedAt: serverTimestamp()
      }
    );

  } catch (error) {

    console.error(
      "Reject call error:",
      error
    );
  }
}


// ============================================================
// END CALL
// ============================================================

async function endCurrentCall() {

  if (currentCallId) {

    try {

      await update(
        callDocumentRef(),
        {
          status: "ended",
          endedAt: serverTimestamp()
        }
      );

    } catch (error) {

      console.error(
        "End call update error:",
        error
      );
    }
  }

  await cleanupCall();
}


// ============================================================
// CLEANUP CALL
// ============================================================

async function cleanupCall() {

  clearInterval(
    callTimerInterval
  );

  callTimerInterval = null;
  callStartTime = null;

  if (unsubscribeCall) {
    unsubscribeCall();
    unsubscribeCall = null;
  }

  if (unsubscribeCallerCandidates) {
    unsubscribeCallerCandidates();
    unsubscribeCallerCandidates = null;
  }

  if (unsubscribeCalleeCandidates) {
    unsubscribeCalleeCandidates();
    unsubscribeCalleeCandidates = null;
  }

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        (track) => track.stop()
      );

    localStream = null;
  }

  if (peerConnection) {

    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;

    peerConnection.close();

    peerConnection = null;
  }

  remoteStream = null;

  const localVideo =
    $("localVideo");

  const remoteVideo =
    $("remoteVideo");

  const remoteAudio =
    $("remoteAudio");

  if (localVideo) {
    localVideo.srcObject = null;
  }

  if (remoteVideo) {
    remoteVideo.srcObject = null;
  }

  if (remoteAudio) {
    remoteAudio.srcObject = null;
  }

  currentCallId = null;
  currentCallType = null;
  currentCallRole = null;

  hide(
    $("callScreen")
  );

  hide(
    $("incomingCallModal")
  );

  pendingIncomingCall = null;
}


// ============================================================
// CALL DOCUMENT REF
// ============================================================

function callDocumentRef() {

  return doc(
    db,
    "diaries",
    diaryId,
    "calls",
    currentCallId
  );
}


// ============================================================
// AUTOMATIC CANDIDATE LISTENING
// ============================================================

function setupCandidateListenersForRole() {

  if (
    currentCallRole === "caller"
  ) {

    subscribeToCalleeCandidates();

  } else if (
    currentCallRole === "callee"
  ) {

    subscribeToCallerCandidates();
  }
}


// ============================================================
// PATCH CALL ROLE LISTENER
// ============================================================

const originalSubscribeToCallDocument =
  subscribeToCallDocument;


// ============================================================
// PERIODIC CALL SIGNAL CHECK
// ============================================================

let candidateWatcherStarted = false;

function ensureCandidateWatcher() {

  if (candidateWatcherStarted) {
    return;
  }

  candidateWatcherStarted = true;

  const interval =
    setInterval(() => {

      if (!currentCallId) {
        candidateWatcherStarted = false;
        clearInterval(interval);
        return;
      }

      setupCandidateListenersForRole();

    }, 500);
}


// ============================================================
// CALL SCREEN OBSERVER
// ============================================================

const originalStartOutgoingCall =
  startOutgoingCall;


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupLogin();

    const localUser =
      getLocalUser();

    if (
      localUser?.name &&
      $("userName")
    ) {
      $("userName").value =
        localUser.name;
    }
  }
);


// ============================================================
// GLOBAL ERROR HANDLERS
// ============================================================

window.addEventListener(
  "online",
  () => {
    showToast("اتصال اینترنت برقرار شد");
  }
);

window.addEventListener(
  "offline",
  () => {
    showToast("اتصال اینترنت قطع شد");
  }
);


// ============================================================
// PREVENT ACCIDENTAL PAGE EXIT DURING CALL
// ============================================================

window.addEventListener(
  "beforeunload",
  (event) => {

    if (currentCallId) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
);
