/* =========================================================
   دفترچه خاطرات مشترک
   Firebase + Chat + Battery + WebRTC
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
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
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
   Firebase
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
const rtdb = getDatabase(app);


/* =========================================================
   تنظیمات اصلی
   ========================================================= */

// این کد عمداً در HTML نمایش داده نمی‌شود.
const FIXED_DIARY_CODE = "asna&amir8890";

let diaryId = FIXED_DIARY_CODE;

let currentUser = null;
let currentUserName = "";
let currentMember = null;
let otherMember = null;

let unsubscribeMembers = null;
let unsubscribeMessages = null;
let unsubscribeCall = null;
let unsubscribeIncoming = null;
let unsubscribeOtherPresence = null;
let unsubscribeOtherBattery = null;

let currentCallId = null;
let currentCallType = null;
let currentCallDoc = null;

let peerConnection = null;
let localStream = null;
let remoteStream = null;

let callTimerInterval = null;
let callStartedAt = null;

let microphoneEnabled = true;
let cameraEnabled = true;
let speakerEnabled = true;

let pendingIncomingCall = null;


/* =========================================================
   عناصر DOM
   ========================================================= */

const $ = id => document.getElementById(id);

const loginScreen = $("loginScreen");
const appScreen = $("appScreen");

const userNameInput = $("userName");
const loginBtn = $("loginBtn");

const themeToggle = $("themeToggle");

const homePage = $("homePage");
const chatPage = $("chatPage");
const settingsPage = $("settingsPage");

const myNameEl = $("myName");
const myBatteryFill = $("myBatteryFill");
const myBatteryText = $("myBatteryText");
const myCharging = $("myCharging");

const otherNameEl = $("otherName");
const otherBatteryFill = $("otherBatteryFill");
const otherBatteryText = $("otherBatteryText");
const otherCharging = $("otherCharging");

const memoryCount = $("memoryCount");
const favoriteCount = $("favoriteCount");
const daysCount = $("daysCount");

const chatPartnerName = $("chatPartnerName");
const chatOnlineStatus = $("chatOnlineStatus");

const messagesContainer = $("messages");
const messageInput = $("messageInput");
const sendMessageBtn = $("sendMessageBtn");

const audioCallBtn = $("audioCallBtn");
const videoCallBtn = $("videoCallBtn");

const settingsName = $("settingsName");
const darkModeToggle = $("darkModeToggle");
const logoutBtn = $("logoutBtn");

const callScreen = $("callScreen");
const remoteVideo = $("remoteVideo");
const localVideo = $("localVideo");
const remoteAudio = $("remoteAudio");

const callTitle = $("callTitle");
const callStatus = $("callStatus");
const callTimer = $("callTimer");

const micBtn = $("micBtn");
const cameraBtn = $("cameraBtn");
const speakerBtn = $("speakerBtn");
const endCallBtn = $("endCallBtn");

const incomingCallModal = $("incomingCallModal");
const incomingCallerName = $("incomingCallerName");
const incomingCallType = $("incomingCallType");
const rejectCallBtn = $("rejectCallBtn");
const acceptCallBtn = $("acceptCallBtn");

const toast = $("toast");
const toastText = $("toastText");


/* =========================================================
   ابزارهای عمومی
   ========================================================= */

function showToast(message) {
  if (!toast || !toastText) return;

  toastText.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}


function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatTime(timestamp) {
  if (!timestamp) return "";

  try {
    const date = timestamp.toDate
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
    const date = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp);

    return date.toLocaleDateString("fa-IR");
  } catch {
    return "";
  }
}


/* =========================================================
   Theme
   ========================================================= */

function setupTheme() {
  const savedTheme = localStorage.getItem("diary-theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  }

  if (darkModeToggle) {
    darkModeToggle.checked =
      document.body.classList.contains("dark");
  }

  themeToggle?.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    const isDark =
      document.body.classList.contains("dark");

    localStorage.setItem(
      "diary-theme",
      isDark ? "dark" : "light"
    );

    if (darkModeToggle) {
      darkModeToggle.checked = isDark;
    }
  });

  darkModeToggle?.addEventListener("change", () => {
    document.body.classList.toggle(
      "dark",
      darkModeToggle.checked
    );

    localStorage.setItem(
      "diary-theme",
      darkModeToggle.checked ? "dark" : "light"
    );
  });
}


/* =========================================================
   Navigation
   ========================================================= */

function setupNavigation() {
  const navItems =
    document.querySelectorAll(".nav-item[data-page]");

  const pageMap = {
    homePage,
    chatPage,
    settingsPage
  };

  function showPage(pageId) {
    Object.values(pageMap).forEach(page => {
      if (page) {
        page.classList.remove("active");
      }
    });

    const page = $(pageId);

    if (page) {
      page.classList.add("active");
    }

    navItems.forEach(item => {
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

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      showPage(item.dataset.page);
    });
  });

  document
    .querySelectorAll('[data-page="chatPage"]')
    .forEach(button => {
      button.addEventListener("click", () => {
        showPage("chatPage");
      });
    });
}


/* =========================================================
   Login
   ========================================================= */

function setupLogin() {
  loginBtn?.addEventListener("click", login);

  userNameInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      login();
    }
  });
}


async function login() {
  const name = userNameInput?.value.trim();

  if (!name) {
    showToast("لطفاً نام خودت را وارد کن");
    userNameInput?.focus();
    return;
  }

  if (name.length > 40) {
    showToast("نام خیلی طولانی است");
    return;
  }

  loginBtn.disabled = true;

  try {
    currentUserName = name;

    localStorage.setItem(
      "diary-user-name",
      currentUserName
    );

    await signInAnonymously(auth);

  } catch (error) {
    console.error(error);

    showToast(
      "ورود انجام نشد؛ اتصال اینترنت را بررسی کن"
    );

    loginBtn.disabled = false;
  }
}


/* =========================================================
   Auth
   ========================================================= */

onAuthStateChanged(auth, async user => {
  if (!user) {
    currentUser = null;

    loginScreen?.classList.remove("hidden");
    appScreen?.classList.remove("active");

    if (loginBtn) {
      loginBtn.disabled = false;
    }

    return;
  }

  currentUser = user;

  const savedName =
    localStorage.getItem("diary-user-name");

  if (!currentUserName && savedName) {
    currentUserName = savedName;
  }

  if (!currentUserName) {
    loginScreen?.classList.remove("hidden");
    return;
  }

  try {
    await initializeDiary();
  } catch (error) {
    console.error(error);
    showToast("خطا در آماده‌سازی دفترچه");
  }
});


/* =========================================================
   Initialize Diary
   ========================================================= */

async function initializeDiary() {
  if (!currentUser) return;

  const memberRef = doc(
    db,
    "diaries",
    diaryId,
    "members",
    currentUser.uid
  );

  const memberSnap = await getDoc(memberRef);

  if (!memberSnap.exists()) {
    await setDoc(memberRef, {
      uid: currentUser.uid,
      name: currentUserName,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    });
  } else {
    await updateDoc(memberRef, {
      name: currentUserName,
      lastSeen: serverTimestamp()
    });
  }

  currentMember = {
    uid: currentUser.uid,
    name: currentUserName
  };

  loginScreen?.classList.add("hidden");
  appScreen?.classList.add("active");

  if (myNameEl) {
    myNameEl.textContent = currentUserName;
  }

  if (settingsName) {
    settingsName.textContent = currentUserName;
  }

  setupMembersListener();
  setupPresence();
  setupBattery();
  setupChat();
  setupIncomingCalls();
  updateStats();
}


/* =========================================================
   Members
   ========================================================= */

function setupMembersListener() {
  if (unsubscribeMembers) {
    unsubscribeMembers();
  }

  const membersRef =
    collection(db, "diaries", diaryId, "members");

  unsubscribeMembers = onSnapshot(
    membersRef,
    snapshot => {
      const members = [];

      snapshot.forEach(docSnap => {
        members.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      currentMember =
        members.find(
          member => member.uid === currentUser?.uid
        ) || currentMember;

      otherMember =
        members.find(
          member => member.uid !== currentUser?.uid
        ) || null;

      updatePartnerUI();

      updateStats();
    },
    error => {
      console.error("Members:", error);
    }
  );
}


function updatePartnerUI() {
  if (!otherMember) {
    if (otherNameEl) {
      otherNameEl.textContent = "نفر دیگر";
    }

    if (chatPartnerName) {
      chatPartnerName.textContent = "نفر دیگر";
    }

    if (chatOnlineStatus) {
      chatOnlineStatus.textContent =
        "در انتظار اتصال...";
    }

    return;
  }

  if (otherNameEl) {
    otherNameEl.textContent =
      otherMember.name || "نفر دیگر";
  }

  if (chatPartnerName) {
    chatPartnerName.textContent =
      otherMember.name || "نفر دیگر";
  }

  subscribeOtherPresence();
  subscribeOtherBattery();
}


/* =========================================================
   Presence
   ========================================================= */

function setupPresence() {
  if (!currentUser) return;

  const presenceRef = ref(
    rtdb,
    `diaries/${diaryId}/presence/${currentUser.uid}`
  );

  set(presenceRef, {
    online: true,
    lastChanged: Date.now()
  }).catch(console.error);

  onDisconnect(presenceRef)
    .set({
      online: false,
      lastChanged: Date.now()
    })
    .catch(console.error);

  window.addEventListener(
    "beforeunload",
    () => {
      set(presenceRef, {
        online: false,
        lastChanged: Date.now()
      }).catch(() => {});
    },
    { once: true }
  );

  subscribeOtherPresence();
}


function subscribeOtherPresence() {
  if (!otherMember) return;

  if (unsubscribeOtherPresence) {
    unsubscribeOtherPresence();
  }

  const presenceRef = ref(
    rtdb,
    `diaries/${diaryId}/presence/${otherMember.uid}`
  );

  unsubscribeOtherPresence = onValue(
    presenceRef,
    snapshot => {
      const data = snapshot.val();

      const online = !!data?.online;

      if (chatOnlineStatus) {
        chatOnlineStatus.textContent =
          online
            ? "آنلاین"
            : "آخرین اتصال ثبت شده";
      }
    }
  );
}


/* =========================================================
   Battery
   ========================================================= */

async function setupBattery() {
  updateMyBattery(100, false);

  if (!navigator.getBattery) {
    updateMyBattery(100, false);
    publishBattery(100, false);
    return;
  }

  try {
    const battery = await navigator.getBattery();

    const update = () => {
      const level =
        Math.round(battery.level * 100);

      const charging =
        battery.charging === true;

      updateMyBattery(level, charging);
      publishBattery(level, charging);
    };

    update();

    battery.addEventListener(
      "levelchange",
      update
    );

    battery.addEventListener(
      "chargingchange",
      update
    );

  } catch (error) {
    console.warn("Battery API unavailable:", error);

    updateMyBattery(100, false);
  }

  subscribeOtherBattery();
}


function updateMyBattery(level, charging) {
  if (myBatteryFill) {
    myBatteryFill.style.width =
      `${Math.max(0, Math.min(100, level))}%`;
  }

  if (myBatteryText) {
    myBatteryText.textContent =
      `${level}%`;
  }

  if (myCharging) {
    myCharging.textContent =
      charging ? "⚡ در حال شارژ" : "";
  }
}


function publishBattery(level, charging) {
  if (!currentUser) return;

  const batteryRef = ref(
    rtdb,
    `diaries/${diaryId}/battery/${currentUser.uid}`
  );

  set(batteryRef, {
    level,
    charging,
    updatedAt: Date.now()
  }).catch(() => {});
}


function subscribeOtherBattery() {
  if (!otherMember) return;

  if (unsubscribeOtherBattery) {
    unsubscribeOtherBattery();
  }

  const batteryRef = ref(
    rtdb,
    `diaries/${diaryId}/battery/${otherMember.uid}`
  );

  unsubscribeOtherBattery = onValue(
    batteryRef,
    snapshot => {
      const data = snapshot.val();

      if (!data) return;

      const level =
        Math.max(
          0,
          Math.min(
            100,
            Number(data.level ?? 0)
          )
        );

      if (otherBatteryFill) {
        otherBatteryFill.style.width =
          `${level}%`;
      }

      if (otherBatteryText) {
        otherBatteryText.textContent =
          `${level}%`;
      }

      if (otherCharging) {
        otherCharging.textContent =
          data.charging
            ? "⚡ در حال شارژ"
            : "";
      }
    }
  );
}


/* =========================================================
   Chat
   ========================================================= */

function setupChat() {
  if (!currentUser) return;

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

  const messagesQuery = query(
    messagesRef,
    orderBy("createdAt", "asc")
  );

  unsubscribeMessages = onSnapshot(
    messagesQuery,
    snapshot => {
      renderMessages(snapshot.docs);
      updateStats();
    },
    error => {
      console.error("Messages:", error);

      /*
       اگر به دلیل Index خطا رخ داد،
       بدون orderBy دوباره دریافت می‌کنیم.
      */

      const fallbackQuery =
        collection(
          db,
          "diaries",
          diaryId,
          "messages"
        );

      onSnapshot(
        fallbackQuery,
        fallbackSnapshot => {
          const docs =
            [...fallbackSnapshot.docs].sort(
              (a, b) => {
                const ta =
                  a.data().createdAt?.toMillis?.() || 0;

                const tb =
                  b.data().createdAt?.toMillis?.() || 0;

                return ta - tb;
              }
            );

          renderMessages(docs);
        }
      );
    }
  );

  sendMessageBtn?.addEventListener(
    "click",
    sendMessage
  );

  messageInput?.addEventListener(
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


async function sendMessage() {
  if (!currentUser) return;

  const text =
    messageInput?.value.trim();

  if (!text) return;

  if (text.length > 4000) {
    showToast("پیام خیلی طولانی است");
    return;
  }

  sendMessageBtn.disabled = true;

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
        type: "text",
        favorite: false,
        createdAt: serverTimestamp()
      }
    );

    messageInput.value = "";
    messageInput.focus();

  } catch (error) {
    console.error(error);
    showToast("پیام ارسال نشد");
  }

  sendMessageBtn.disabled = false;
}


function renderMessages(docs) {
  if (!messagesContainer) return;

  messagesContainer.innerHTML = "";

  if (!docs.length) {
    messagesContainer.innerHTML = `
      <div class="empty-chat">
        <div class="empty-chat-icon">💌</div>
        <div>هنوز پیامی نوشته نشده</div>
        <small>اولین خاطره‌تان را اینجا ثبت کنید</small>
      </div>
    `;

    return;
  }

  docs.forEach(docSnap => {
    const data = docSnap.data();

    const mine =
      data.senderUid === currentUser?.uid;

    const message = document.createElement("div");

    message.className =
      `message ${mine ? "mine" : "other"}`;

    const favoriteIcon =
      data.favorite ? "❤️" : "";

    message.innerHTML = `
      <div class="message-content">
        <div class="message-text">
          ${escapeHTML(data.text)}
        </div>

        <div class="message-meta">
          <span>${formatTime(data.createdAt)}</span>
          ${favoriteIcon
            ? `<span>${favoriteIcon}</span>`
            : ""}
        </div>
      </div>
    `;

    message.addEventListener(
      "contextmenu",
      event => {
        event.preventDefault();
        toggleFavorite(docSnap.id, data.favorite);
      }
    );

    messagesContainer.appendChild(message);
  });

  requestAnimationFrame(() => {
    messagesContainer.scrollTop =
      messagesContainer.scrollHeight;
  });
}


async function toggleFavorite(messageId, currentValue) {
  try {
    const messageRef = doc(
      db,
      "diaries",
      diaryId,
      "messages",
      messageId
    );

    await updateDoc(messageRef, {
      favorite: !currentValue
    });

    showToast(
      currentValue
        ? "از علاقه‌مندی‌ها حذف شد"
        : "به علاقه‌مندی‌ها اضافه شد"
    );

  } catch (error) {
    console.error(error);
  }
}


/* =========================================================
   Stats
   ========================================================= */

async function updateStats() {
  if (!currentUser) return;

  try {
    const messagesSnap =
      await getDocs(
        collection(
          db,
          "diaries",
          diaryId,
          "messages"
        )
      );

    let favorite = 0;
    const days = new Set();

    messagesSnap.forEach(docSnap => {
      const data = docSnap.data();

      if (data.favorite) {
        favorite++;
      }

      if (data.createdAt) {
        days.add(formatDate(data.createdAt));
      }
    });

    if (memoryCount) {
      memoryCount.textContent =
        messagesSnap.size;
    }

    if (favoriteCount) {
      favoriteCount.textContent =
        favorite;
    }

    if (daysCount) {
      daysCount.textContent =
        days.size;
    }

  } catch (error) {
    console.warn("Stats:", error);
  }
}


/* =========================================================
   Settings
   ========================================================= */

function setupSettings() {
  logoutBtn?.addEventListener(
    "click",
    logout
  );

  if (settingsName) {
    settingsName.addEventListener(
      "click",
      () => {
        showToast(
          "نام در صفحه ورود تعیین می‌شود"
        );
      }
    );
  }
}


async function logout() {
  try {
    localStorage.removeItem(
      "diary-user-name"
    );

    currentUserName = "";

    await signOut(auth);

    showToast("خارج شدی");

  } catch (error) {
    console.error(error);
    showToast("خروج انجام نشد");
  }
}


/* =========================================================
   WebRTC
   ========================================================= */

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


function setupCallButtons() {
  audioCallBtn?.addEventListener(
    "click",
    () => startCall("audio")
  );

  videoCallBtn?.addEventListener(
    "click",
    () => startCall("video")
  );

  rejectCallBtn?.addEventListener(
    "click",
    rejectIncomingCall
  );

  acceptCallBtn?.addEventListener(
    "click",
    acceptIncomingCall
  );

  endCallBtn?.addEventListener(
    "click",
    endCall
  );

  micBtn?.addEventListener(
    "click",
    toggleMicrophone
  );

  cameraBtn?.addEventListener(
    "click",
    toggleCamera
  );

  speakerBtn?.addEventListener(
    "click",
    toggleSpeaker
  );
}


/* =========================================================
   Start Call
   ========================================================= */

async function startCall(type) {
  if (!currentUser) return;

  if (!otherMember) {
    showToast("هنوز نفر دوم وارد دفترچه نشده");
    return;
  }

  if (currentCallId) {
    showToast("یک تماس در حال انجام است");
    return;
  }

  try {
    currentCallType = type;

    const callRef = await addDoc(
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
        calleeName: otherMember.name || "نفر دیگر",
        type,
        status: "ringing",
        createdAt: serverTimestamp()
      }
    );

    currentCallId = callRef.id;

    await openLocalMedia(type);

    createPeerConnection();

    showCallScreen(
      type,
      false
    );

    const offer =
      await peerConnection.createOffer();

    await peerConnection.setLocalDescription(
      offer
    );

    await updateDoc(callRef, {
      offer: {
        type: offer.type,
        sdp: offer.sdp
      }
    });

    listenToCallDocument(callRef.id);

    await listenForCandidates(
      callRef.id,
      "callerCandidates"
    );

    callStatus.textContent =
      "در حال برقراری تماس...";

  } catch (error) {
    console.error("Start call:", error);

    showToast(
      "برقراری تماس ممکن نشد"
    );

    await cleanupCall();
  }
}


/* =========================================================
   Incoming Calls
   ========================================================= */

function setupIncomingCalls() {
  if (!currentUser) return;

  if (unsubscribeIncoming) {
    unsubscribeIncoming();
  }

  const callsRef =
    collection(
      db,
      "diaries",
      diaryId,
      "calls"
    );

  const incomingQuery = query(
    callsRef,
    where(
      "calleeUid",
      "==",
      currentUser.uid
    )
  );

  unsubscribeIncoming =
    onSnapshot(
      incomingQuery,
      snapshot => {
        snapshot.docChanges().forEach(change => {
          if (
            change.type !== "added" &&
            change.type !== "modified"
          ) {
            return;
          }

          const data = change.doc.data();

          if (
            data.status === "ringing" &&
            !currentCallId
          ) {
            showIncomingCall(
              change.doc.id,
              data
            );
          }
        });
      },
      error => {
        console.error(
          "Incoming calls:",
          error
        );
      }
    );
}


function showIncomingCall(callId, data) {
  pendingIncomingCall = {
    id: callId,
    data
  };

  if (incomingCallerName) {
    incomingCallerName.textContent =
      data.callerName || "نفر دیگر";
  }

  if (incomingCallType) {
    incomingCallType.textContent =
      data.type === "video"
        ? "تماس تصویری"
        : "تماس صوتی";
  }

  incomingCallModal?.classList.add("show");
}


async function acceptIncomingCall() {
  if (!pendingIncomingCall) return;

  const {
    id,
    data
  } = pendingIncomingCall;

  pendingIncomingCall = null;

  incomingCallModal?.classList.remove("show");

  try {
    currentCallId = id;
    currentCallType = data.type;

    const callRef = doc(
      db,
      "diaries",
      diaryId,
      "calls",
      id
    );

    const callSnap =
      await getDoc(callRef);

    if (!callSnap.exists()) {
      throw new Error(
        "Call does not exist"
      );
    }

    const callData =
      callSnap.data();

    await updateDoc(callRef, {
      status: "accepted"
    });

    await openLocalMedia(
      data.type
    );

    createPeerConnection();

    showCallScreen(
      data.type,
      true
    );

    if (callData.offer) {
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

      await updateDoc(callRef, {
        answer: {
          type: answer.type,
          sdp: answer.sdp
        }
      });
    }

    listenToCallDocument(id);

    await listenForCandidates(
      id,
      "calleeCandidates"
    );

    callStatus.textContent =
      "متصل";

    startCallTimer();

  } catch (error) {
    console.error(
      "Accept call:",
      error
    );

    showToast(
      "پذیرش تماس انجام نشد"
    );

    await cleanupCall();
  }
}


async function rejectIncomingCall() {
  if (!pendingIncomingCall) {
    incomingCallModal?.classList.remove(
      "show"
    );
    return;
  }

  const callId =
    pendingIncomingCall.id;

  pendingIncomingCall = null;

  incomingCallModal?.classList.remove(
    "show"
  );

  try {
    const callRef = doc(
      db,
      "diaries",
      diaryId,
      "calls",
      callId
    );

    await updateDoc(callRef, {
      status: "rejected"
    });

  } catch (error) {
    console.error(error);
  }
}


/* =========================================================
   Peer Connection
   ========================================================= */

function createPeerConnection() {
  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection =
    new RTCPeerConnection(
      ICE_SERVERS
    );

  remoteStream =
    new MediaStream();

  if (remoteVideo) {
    remoteVideo.srcObject =
      remoteStream;
  }

  if (remoteAudio) {
    remoteAudio.srcObject =
      remoteStream;
  }

  if (localStream) {
    localStream
      .getTracks()
      .forEach(track => {
        peerConnection.addTrack(
          track,
          localStream
        );
      });
  }

  peerConnection.ontrack = event => {
    event.streams[0]
      ?.getTracks()
      .forEach(track => {
        remoteStream.addTrack(track);
      });

    if (remoteVideo) {
      remoteVideo.srcObject =
        remoteStream;
    }

    if (remoteAudio) {
      remoteAudio.srcObject =
        remoteStream;
    }

    callStatus.textContent =
      "متصل";

    startCallTimer();
  };

  peerConnection.onconnectionstatechange =
    () => {
      const state =
        peerConnection.connectionState;

      if (
        state === "connected"
      ) {
        callStatus.textContent =
          "متصل";

        startCallTimer();
      }

      if (
        state === "disconnected" ||
        state === "failed"
      ) {
        callStatus.textContent =
          "ارتباط قطع شد";
      }

      if (
        state === "closed"
      ) {
        callStatus.textContent =
          "تماس پایان یافت";
      }
    };

  peerConnection.onicecandidate =
    async event => {
      if (!event.candidate) return;
      if (!currentCallId) return;

      const side =
        isCaller
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
            side
          ),
          {
            candidate:
              event.candidate.toJSON(),
            createdAt:
              serverTimestamp()
          }
        );
      } catch (error) {
        console.error(
          "ICE candidate:",
          error
        );
      }
    };
}


/*
  مشخص می‌کند کاربر Caller است یا Callee.
*/
let isCaller = false;


/* =========================================================
   Local Media
   ========================================================= */

async function openLocalMedia(type) {
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

  try {
    localStream =
      await navigator.mediaDevices.getUserMedia(
        constraints
      );

    microphoneEnabled = true;
    cameraEnabled =
      type === "video";

    if (localVideo) {
      localVideo.srcObject =
        localStream;
    }

    if (type !== "video") {
      cameraEnabled = false;
    }

  } catch (error) {
    console.error(
      "getUserMedia:",
      error
    );

    if (type === "video") {
      showToast(
        "دسترسی دوربین یا میکروفون داده نشد"
      );
    } else {
      showToast(
        "دسترسی میکروفون داده نشد"
      );
    }

    throw error;
  }
}


/* =========================================================
   Call Document Listener
   ========================================================= */

function listenToCallDocument(callId) {
  if (unsubscribeCall) {
    unsubscribeCall();
  }

  const callRef = doc(
    db,
    "diaries",
    diaryId,
    "calls",
    callId
  );

  unsubscribeCall =
    onSnapshot(
      callRef,
      async snapshot => {
        if (!snapshot.exists()) return;

        const data =
          snapshot.data();

        currentCallDoc = data;

        if (
          isCaller &&
          data.answer &&
          peerConnection &&
          !peerConnection.currentRemoteDescription
        ) {
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(
                data.answer
              )
            );

            callStatus.textContent =
              "متصل";

            startCallTimer();

          } catch (error) {
            console.error(
              "Set answer:",
              error
            );
          }
        }

        if (
          data.status === "rejected"
        ) {
          showToast(
            "تماس رد شد"
          );

          await cleanupCall();
        }

        if (
          data.status === "ended"
        ) {
          await cleanupCall();
        }
      },
      error => {
        console.error(
          "Call listener:",
          error
        );
      }
    );
}


/* =========================================================
   ICE Candidates
   ========================================================= */

async function listenForCandidates(
  callId,
  collectionName
) {
  if (!peerConnection) return;

  const candidatesRef =
    collection(
      db,
      "diaries",
      diaryId,
      "calls",
      callId,
      collectionName
    );

  onSnapshot(
    candidatesRef,
    snapshot => {
      snapshot.docChanges()
        .forEach(async change => {
          if (
            change.type !== "added"
          ) {
            return;
          }

          const data =
            change.doc.data();

          if (!data.candidate) {
            return;
          }

          try {
            await peerConnection.addIceCandidate(
              new RTCIceCandidate(
                data.candidate
              )
            );
          } catch (error) {
            console.warn(
              "ICE add:",
              error
            );
          }
        });
    }
  );
}


/* =========================================================
   Call UI
   ========================================================= */

function showCallScreen(
  type,
  incoming
) {
  if (!callScreen) return;

  callScreen.classList.add(
    "active"
  );

  if (callTitle) {
    callTitle.textContent =
      type === "video"
        ? "تماس تصویری"
        : "تماس صوتی";
  }

  if (callStatus) {
    callStatus.textContent =
      incoming
        ? "در حال اتصال..."
        : "در حال برقراری تماس...";
  }

  if (callTimer) {
    callTimer.textContent =
      "00:00";
  }

  microphoneEnabled = true;
  cameraEnabled =
    type === "video";
  speakerEnabled = true;

  updateCallButtons();

  if (type === "video") {
    remoteVideo?.classList.add(
      "visible"
    );
    localVideo?.classList.add(
      "visible"
    );
  } else {
    remoteVideo?.classList.remove(
      "visible"
    );
    localVideo?.classList.remove(
      "visible"
    );
  }
}


/* =========================================================
   Call Controls
   ========================================================= */

function toggleMicrophone() {
  if (!localStream) return;

  const tracks =
    localStream.getAudioTracks();

  if (!tracks.length) return;

  microphoneEnabled =
    !microphoneEnabled;

  tracks.forEach(track => {
    track.enabled =
      microphoneEnabled;
  });

  updateCallButtons();
}


function toggleCamera() {
  if (!localStream) return;

  const tracks =
    localStream.getVideoTracks();

  if (!tracks.length) {
    showToast(
      "این تماس دوربین ندارد"
    );
    return;
  }

  cameraEnabled =
    !cameraEnabled;

  tracks.forEach(track => {
    track.enabled =
      cameraEnabled;
  });

  updateCallButtons();
}


function toggleSpeaker() {
  speakerEnabled =
    !speakerEnabled;

  if (remoteAudio) {
    remoteAudio.muted =
      !speakerEnabled;
  }

  if (remoteVideo) {
    remoteVideo.muted =
      !speakerEnabled;
  }

  updateCallButtons();
}


function updateCallButtons() {
  if (micBtn) {
    micBtn.classList.toggle(
      "off",
      !microphoneEnabled
    );

    micBtn.textContent =
      microphoneEnabled
        ? "🎙️"
        : "🔇";
  }

  if (cameraBtn) {
    cameraBtn.classList.toggle(
      "off",
      !cameraEnabled
    );

    cameraBtn.textContent =
      cameraEnabled
        ? "📹"
        : "🚫";
  }

  if (speakerBtn) {
    speakerBtn.classList.toggle(
      "off",
      !speakerEnabled
    );

    speakerBtn.textContent =
      speakerEnabled
        ? "🔊"
        : "🔇";
  }
}


/* =========================================================
   Call Timer
   ========================================================= */

function startCallTimer() {
  if (callTimerInterval) {
    return;
  }

  callStartedAt =
    Date.now();

  callTimerInterval =
    setInterval(() => {
      if (!callTimer) return;

      const seconds =
        Math.floor(
          (Date.now() -
            callStartedAt) /
            1000
        );

      const minutes =
        Math.floor(
          seconds / 60
        );

      const remaining =
        seconds % 60;

      callTimer.textContent =
        `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
    }, 1000);
}


/* =========================================================
   End Call
   ========================================================= */

async function endCall() {
  try {
    if (
      currentCallId &&
      currentUser
    ) {
      const callRef = doc(
        db,
        "diaries",
        diaryId,
        "calls",
        currentCallId
      );

      await updateDoc(
        callRef,
        {
          status: "ended",
          endedAt: serverTimestamp()
        }
      );
    }
  } catch (error) {
    console.warn(
      "End call update:",
      error
    );
  }

  await cleanupCall();
}


async function cleanupCall() {
  if (callTimerInterval) {
    clearInterval(
      callTimerInterval
    );

    callTimerInterval = null;
  }

  if (unsubscribeCall) {
    unsubscribeCall();
    unsubscribeCall = null;
  }

  if (peerConnection) {
    try {
      peerConnection.close();
    } catch {}
  }

  peerConnection = null;

  if (localStream) {
    localStream
      .getTracks()
      .forEach(track => {
        track.stop();
      });
  }

  localStream = null;
  remoteStream = null;

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
  currentCallDoc = null;

  microphoneEnabled = true;
  cameraEnabled = true;
  speakerEnabled = true;

  callScreen?.classList.remove(
    "active"
  );
}


/* =========================================================
   تنظیم Caller
   ========================================================= */

async function startCallerConnection(
  callId
) {
  isCaller = true;

  listenToCallDocument(
    callId
  );

  await listenForCandidates(
    callId,
    "calleeCandidates"
  );
}


/* =========================================================
   اصلاح Start Call برای Caller
   ========================================================= */

const originalStartCall = startCall;

startCall = async function(type) {
  isCaller = true;

  if (!currentUser) return;

  if (!otherMember) {
    showToast(
      "هنوز نفر دوم وارد دفترچه نشده"
    );
    return;
  }

  if (currentCallId) {
    showToast(
      "یک تماس در حال انجام است"
    );
    return;
  }

  try {
    currentCallType = type;

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

          calleeName:
            otherMember.name ||
            "نفر دیگر",

          type,

          status:
            "ringing",

          createdAt:
            serverTimestamp()
        }
      );

    currentCallId =
      callRef.id;

    await openLocalMedia(
      type
    );

    createPeerConnection();

    showCallScreen(
      type,
      false
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
          type: offer.type,
          sdp: offer.sdp
        }
      }
    );

    await startCallerConnection(
      callRef.id
    );

    callStatus.textContent =
      "در حال برقراری تماس...";

  } catch (error) {
    console.error(
      "Start call:",
      error
    );

    showToast(
      "برقراری تماس ممکن نشد"
    );

    await cleanupCall();
  }
};


/* =========================================================
   اصلاح Accept برای Callee
   ========================================================= */

const originalAcceptIncomingCall =
  acceptIncomingCall;

acceptIncomingCall = async function() {
  isCaller = false;

  if (!pendingIncomingCall) return;

  const {
    id,
    data
  } = pendingIncomingCall;

  pendingIncomingCall = null;

  incomingCallModal?.classList.remove(
    "show"
  );

  try {
    currentCallId = id;
    currentCallType = data.type;

    const callRef = doc(
      db,
      "diaries",
      diaryId,
      "calls",
      id
    );

    const callSnap =
      await getDoc(callRef);

    if (!callSnap.exists()) {
      throw new Error(
        "Call not found"
      );
    }

    const callData =
      callSnap.data();

    await openLocalMedia(
      data.type
    );

    createPeerConnection();

    showCallScreen(
      data.type,
      true
    );

    if (callData.offer) {
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

      await updateDoc(
        callRef,
        {
          status: "accepted",

          answer: {
            type: answer.type,
            sdp: answer.sdp
          }
        }
      );
    }

    await listenForCandidates(
      id,
      "callerCandidates"
    );

    listenToCallDocument(id);

    callStatus.textContent =
      "متصل";

    startCallTimer();

  } catch (error) {
    console.error(
      "Accept call:",
      error
    );

    showToast(
      "پذیرش تماس انجام نشد"
    );

    await cleanupCall();
  }
};


/* =========================================================
   Auto Login
   ========================================================= */

function restoreSavedName() {
  const savedName =
    localStorage.getItem(
      "diary-user-name"
    );

  if (
    savedName &&
    userNameInput
  ) {
    userNameInput.value =
      savedName;
  }
}


/* =========================================================
   Initialization
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    setupTheme();
    setupNavigation();
    setupLogin();
    setupSettings();
    setupCallButtons();
    restoreSavedName();

    const savedName =
      localStorage.getItem(
        "diary-user-name"
      );

    if (savedName) {
      currentUserName =
        savedName;
    }
  }
);
