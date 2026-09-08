/* =========================================================
   دفترچه خاطرات مشترک
   Firebase + Firestore + Realtime Database + WebRTC
   Diary: asna&amir8890
========================================================= */

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

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
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getDatabase,
  ref,
  set,
  update,
  onValue,
  onDisconnect,
  serverTimestamp as rtdbServerTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";


/* =========================================================
   CONFIG
========================================================= */

const FIXED_DIARY_CODE = "asna&amir8890";

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
   FIREBASE
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);


/* =========================================================
   STATE
========================================================= */

let currentUser = null;
let diaryId = FIXED_DIARY_CODE;
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

let myBatteryLevel = null;
let myCharging = false;

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

let toastTimer = null;


/* =========================================================
   DOM
========================================================= */

function $(id) {
  return document.getElementById(id);
}

function getMessagesContainer() {
  return $("messages") ||
         $("chatMessages") ||
         $("messagesContainer");
}

function getMessageInput() {
  return $("messageInput") ||
         $("chatInput");
}

function getSendButton() {
  return $("sendMessageBtn") ||
         $("sendBtn");
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message, icon = "✓") {

  const toast = $("toast");
  const toastMessage = $("toastMessage");
  const toastIcon = $("toastIcon");

  if (!toast || !toastMessage) {
    console.log(message);
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
   HELPERS
========================================================= */

function escapeHTML(value) {

  const div = document.createElement("div");

  div.textContent = value ?? "";

  return div.innerHTML;
}


function formatDate(timestamp) {

  if (!timestamp) return "";

  let date;

  try {

    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

  } catch {
    return "";
  }

  if (isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(
    "fa-IR",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}


function normalizeDiaryCode(code) {

  return String(code || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}


/* =========================================================
   FIREBASE ERROR
========================================================= */

function firebaseErrorMessage(error) {

  console.error(error);

  const code = error?.code || "";

  if (
    code.includes("permission-denied") ||
    code.includes("PERMISSION_DENIED")
  ) {
    return "دسترسی به دفترچه امکان‌پذیر نیست";
  }

  if (
    code.includes("network") ||
    code.includes("unavailable")
  ) {
    return "اتصال اینترنت را بررسی کنید";
  }

  if (code.includes("auth")) {
    return "ورود به Firebase انجام نشد";
  }

  return "خطایی رخ داد؛ دوباره امتحان کنید";
}


/* =========================================================
   LOGIN
========================================================= */

async function login() {

  const nameInput = $("userName");
  const codeInput = $("diaryCode");

  if (!nameInput) return;

  const name = nameInput.value.trim();

  /* کد دفترچه همیشه ثابت است */

  diaryId = FIXED_DIARY_CODE;

  if (codeInput) {
    codeInput.value = FIXED_DIARY_CODE;
    codeInput.readOnly = true;
  }

  if (!name) {

    showToast(
      "نام خود را وارد کنید",
      "⚠️"
    );

    nameInput.focus();

    return;
  }

  if (name.length < 2) {

    showToast(
      "نام وارد شده کوتاه است",
      "⚠️"
    );

    return;
  }

  const button = $("loginBtn");

  if (button) {
    button.disabled = true;
    button.style.opacity = "0.6";
  }

  try {

    /* ورود Anonymous */

    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("AUTH_FAILED");
    }

    currentName = name;

    /*
      اول Member خودمان را می‌خوانیم.
      Rules جدید اجازه می‌دهد هر کاربر
      Member خودش را هنگام ورود بخواند.
    */

    const memberRef = doc(
      db,
      "diaries",
      diaryId,
      "members",
      currentUser.uid
    );

    const memberSnapshot =
      await getDoc(memberRef);


    if (!memberSnapshot.exists()) {

      await setDoc(
        memberRef,
        {
          uid: currentUser.uid,
          name: currentName,
          createdAt: serverTimestamp(),
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

    console.error(
      "LOGIN ERROR:",
      error
    );

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
    $("chatStatus").textContent =
      "دفترچه مشترک";
  }
}


/* =========================================================
   SETUP
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

  setupCallButtons();

  updateMyBatteryUI();

  updateCallButtonsUI();
}


/* =========================================================
   MEMBERS
========================================================= */

function subscribeMembers() {

  if (!diaryId || !currentUser) return;

  const membersRef = collection(
    db,
    "diaries",
    diaryId,
    "members"
  );

  unsubscribeMembers =
    onSnapshot(
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
              member.uid !== currentUser.uid
          ) || null;

        updatePartnerUI();

        /*
          بعد از پیدا شدن نفر دوم
          Presence و Battery او را فعال می‌کنیم.
        */

        if (otherMember) {

          subscribeOtherPresence();

          subscribeOtherBattery();

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


function getOtherMember() {

  return (
    members.find(
      member =>
        member.uid !== currentUser?.uid
    ) || null
  );
}


function updatePartnerUI() {

  otherMember = getOtherMember();

  const name =
    otherMember?.name ||
    "نفر دیگر";

  if ($("otherName")) {
    $("otherName").textContent = name;
  }

  if ($("partnerName")) {
    $("partnerName").textContent = name;
  }

  if ($("chatPartnerName")) {
    $("chatPartnerName").textContent = name;
  }

  if ($("partnerStatus")) {
    $("partnerStatus").textContent =
      otherMember
        ? "متصل به دفترچه"
        : "منتظر ورود نفر دوم";
  }

  if ($("chatStatus")) {
    $("chatStatus").textContent =
      otherMember
        ? "آنلاین در دفترچه مشترک"
        : "منتظر ورود نفر دوم";
  }
}


/* =========================================================
   CHAT
========================================================= */

function subscribeMessages() {

  if (!diaryId) return;

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

      }
    );
}


function renderMessages() {

  const container =
    getMessagesContainer();

  if (!container) return;

  if (!currentMessages.length) {

    container.innerHTML = `
      <div class="empty-chat">
        <div>💌</div>
        <p>هنوز پیامی ثبت نشده است</p>
        <small>اولین خاطره را اینجا بنویسید</small>
      </div>
    `;

    return;
  }

  container.innerHTML =
    currentMessages
      .map(message => {

        const mine =
          message.senderUid ===
          currentUser?.uid;

        return `
          <div class="message-row ${mine ? "mine" : "other"}">
            <div class="message-bubble">

              <div class="message-sender">
                ${escapeHTML(message.senderName || "")}
              </div>

              <div class="message-text">
                ${escapeHTML(message.text || "")}
              </div>

              <div class="message-time">
                ${formatDate(message.createdAt)}
              </div>

            </div>
          </div>
        `;

      })
      .join("");

  container.scrollTop =
    container.scrollHeight;
}


async function sendMessage() {

  const input =
    getMessageInput();

  if (!input || !currentUser) return;

  const text =
    input.value.trim();

  if (!text) return;

  try {

    const messagesRef =
      collection(
        db,
        "diaries",
        diaryId,
        "messages"
      );

    await addDoc(
      messagesRef,
      {
        senderUid: currentUser.uid,
        senderName: currentName,
        text: text,
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
      firebaseErrorMessage(error),
      "❌"
    );
  }
}


function setupChat() {

  const sendButton =
    getSendButton();

  const input =
    getMessageInput();

  if (sendButton) {

    sendButton.onclick =
      sendMessage;

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

    input.addEventListener(
      "input",
      autoResizeTextarea
    );
  }
}


function autoResizeTextarea() {

  const input =
    getMessageInput();

  if (!input) return;

  input.style.height = "auto";

  input.style.height =
    Math.min(
      input.scrollHeight,
      140
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
    favoriteCount.textContent =
      currentMessages.filter(
        message => message.favorite === true
      ).length;
  }

  if (daysCount) {

    const days =
      new Set();

    currentMessages.forEach(
      message => {

        if (!message.createdAt) return;

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
      }
    );

    daysCount.textContent =
      days.size;
  }
}


/* =========================================================
   PRESENCE
========================================================= */

function setupPresence() {

  if (!currentUser || !diaryId) return;

  const presenceRef =
    ref(
      rtdb,
      `diaries/${diaryId}/presence/${currentUser.uid}`
    );

  set(
    presenceRef,
    {
      online: true,
      name: currentName,
      lastSeen: rtdbServerTimestamp()
    }
  ).catch(error => {

    console.error(
      "PRESENCE SET ERROR:",
      error
    );

  });

  onDisconnect(presenceRef)
    .set({
      online: false,
      name: currentName,
      lastSeen: rtdbServerTimestamp()
    })
    .catch(error => {

      console.error(
        "ON DISCONNECT ERROR:",
        error
      );

    });
}


function subscribeOtherPresence() {

  if (!otherMember || !diaryId) return;

  if (unsubscribePresence) {
    unsubscribePresence();
    unsubscribePresence = null;
  }

  const presenceRef =
    ref(
      rtdb,
      `diaries/${diaryId}/presence/${otherMember.uid}`
    );

  unsubscribePresence =
    onValue(
      presenceRef,
      snapshot => {

        const data =
          snapshot.val();

        const online =
          data?.online === true;

        const status =
          online
            ? "آنلاین"
            : "آفلاین";

        if ($("partnerStatus")) {
          $("partnerStatus").textContent =
            status;
        }

        if ($("chatStatus")) {
          $("chatStatus").textContent =
            status;
        }
      },

      error => {

        console.error(
          "PRESENCE ERROR:",
          error
        );

      }
    );
}


/* =========================================================
   BATTERY
========================================================= */

async function setupBattery() {

  if (
    !navigator.getBattery
  ) {

    updateMyBatteryUI();

    return;
  }

  try {

    const battery =
      await navigator.getBattery();

    myBatteryLevel =
      battery.level;

    myCharging =
      battery.charging;

    updateMyBatteryUI();

    const updateBattery =
      () => {

        myBatteryLevel =
          battery.level;

        myCharging =
          battery.charging;

        updateMyBatteryUI();

        updateBatteryToFirebase();
      };

    battery.addEventListener(
      "levelchange",
      updateBattery
    );

    battery.addEventListener(
      "chargingchange",
      updateBattery
    );

    updateBatteryToFirebase();

  } catch (error) {

    console.error(
      "BATTERY ERROR:",
      error
    );

  }
}


function updateMyBatteryUI() {

  if (
    myBatteryLevel === null
  ) {
    return;
  }

  const percent =
    Math.round(
      myBatteryLevel * 100
    );

  if ($("myBattery")) {
    $("myBattery").textContent =
      percent + "%";
  }

  if ($("myBatteryFill")) {
    $("myBatteryFill").style.width =
      percent + "%";
  }

  if ($("myCharging")) {
    $("myCharging").textContent =
      myCharging
        ? "⚡ در حال شارژ"
        : "در حال استفاده";
  }
}


async function updateBatteryToFirebase() {

  if (!currentUser || !diaryId) return;

  try {

    await update(
      ref(
        rtdb,
        `diaries/${diaryId}/presence/${currentUser.uid}`
      ),
      {
        battery:
          myBatteryLevel !== null
            ? Math.round(myBatteryLevel * 100)
            : null,

        charging:
          myCharging,

        batteryUpdatedAt:
          rtdbServerTimestamp()
      }
    );

  } catch (error) {

    console.error(
      "BATTERY FIREBASE ERROR:",
      error
    );

  }
}


function subscribeOtherBattery() {

  if (!otherMember || !diaryId) return;

  if (unsubscribeBattery) {
    unsubscribeBattery();
    unsubscribeBattery = null;
  }

  const batteryRef =
    ref(
      rtdb,
      `diaries/${diaryId}/presence/${otherMember.uid}`
    );

  unsubscribeBattery =
    onValue(
      batteryRef,
      snapshot => {

        const data =
          snapshot.val();

        const percent =
          typeof data?.battery === "number"
            ? data.battery
            : null;

        const charging =
          data?.charging === true;

        if (
          percent !== null &&
          $("otherBattery")
        ) {

          $("otherBattery").textContent =
            percent + "%";
        }

        if (
          percent !== null &&
          $("otherBatteryFill")
        ) {

          $("otherBatteryFill").style.width =
            percent + "%";
        }

        if ($("otherCharging")) {

          $("otherCharging").textContent =
            charging
              ? "⚡ در حال شارژ"
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
   THEME
========================================================= */

function setupTheme() {

  const saved =
    localStorage.getItem(
      "diaryTheme"
    );

  if (saved === "dark") {

    document.body.classList.add(
      "dark"
    );

  } else {

    document.body.classList.remove(
      "dark"
    );
  }

  const themeToggle =
    $("themeToggle");

  const darkModeToggle =
    $("darkModeToggle");

  if (themeToggle) {

    themeToggle.onclick =
      toggleTheme;

  }

  if (darkModeToggle) {

    darkModeToggle.onclick =
      toggleTheme;

  }

  updateThemeButton();
}


function toggleTheme() {

  const dark =
    document.body.classList.toggle(
      "dark"
    );

  localStorage.setItem(
    "diaryTheme",
    dark ? "dark" : "light"
  );

  updateThemeButton();
}


function updateThemeButton() {

  const dark =
    document.body.classList.contains(
      "dark"
    );

  const button =
    $("themeToggle");

  if (button) {

    button.textContent =
      dark ? "☀️" : "🌙";

  }

  const darkModeToggle =
    $("darkModeToggle");

  if (
    darkModeToggle &&
    darkModeToggle.type === "checkbox"
  ) {

    darkModeToggle.checked =
      dark;
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
   WEBRTC BUTTONS
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

  /*
    FIX:
    قبلاً اینجا تابع بلافاصله اجرا می‌شد.
    الان فقط هنگام کلیک اجرا می‌شود.
  */

  if (rejectCallBtn) {

    rejectCallBtn.onclick =
      rejectIncomingCall;

  }

  if (endCallBtn) {

    endCallBtn.onclick =
      () => endCurrentCall(false);

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
   OUTGOING CALL
========================================================= */

async function startOutgoingCall(type) {

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
          callerUid:
            currentUser.uid,

          callerName:
            currentName,

          calleeUid:
            partner.uid,

          calleeName:
            partner.name,

          type:
            type,

          status:
            "ringing",

          offer: {
            type:
              offer.type,

            sdp:
              offer.sdp
          },

          createdAt:
            serverTimestamp()
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
   MEDIA
========================================================= */

async function getLocalMedia(type) {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "MEDIA_NOT_SUPPORTED"
    );
  }

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

  micEnabled = false;
  cameraEnabled = false;

  const localVideo =
    $("localVideo");

  if (localVideo) {

    localVideo.srcObject =
      stream;

    localVideo.muted = true;

    localVideo.play()
      .catch(() => {});
  }

  updateCallButtonsUI();

  return stream;
}


/* =========================================================
   PEER CONNECTION
========================================================= */

function createPeerConnection(role) {

  const pc =
    new RTCPeerConnection(
      rtcConfig
    );

  pc.ontrack =
    event => {

      if (!remoteStream) {

        remoteStream =
          new MediaStream();

      }

      const incomingStream =
        event.streams?.[0];

      if (incomingStream) {

        incomingStream
          .getTracks()
          .forEach(track => {

            if (
              !remoteStream
                .getTracks()
                .some(
                  existing =>
                    existing.id ===
                    track.id
                )
            ) {

              remoteStream.addTrack(
                track
              );
            }
          });

      } else {

        remoteStream.addTrack(
          event.track
        );
      }

      const remoteVideo =
        $("remoteVideo");

      const remoteAudio =
        $("remoteAudio");

      if (remoteVideo) {

        remoteVideo.srcObject =
          remoteStream;

        remoteVideo.play()
          .catch(() => {});
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
          "ICE ERROR:",
          error
        );
      }
    };


  pc.onconnectionstatechange =
    () => {

      console.log(
        "WebRTC:",
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

        endCurrentCall(true);
      }

      if (
        pc.connectionState ===
        "closed"
      ) {

        stopCallTimer();
      }
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

    unsubscribeCurrentCall = null;
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

          cleanupCall();

          return;
        }

        const data =
          snapshot.data();

        if (
          currentCallRole ===
          "caller"
        ) {

          if (
            data.status ===
            "accepted"
          ) {

            if (
              data.answer &&
              peerConnection
            ) {

              const currentDescription =
                peerConnection
                  .currentRemoteDescription;

              if (!currentDescription) {

                try {

                  await peerConnection
                    .setRemoteDescription(
                      new RTCSessionDescription(
                        data.answer
                      )
                    );

                  setCallStatus(
                    "در حال اتصال..."
                  );

                } catch (error) {

                  console.error(
                    "REMOTE ANSWER ERROR:",
                    error
                  );
                }
              }
            }
          }

          if (
            data.status ===
            "rejected"
          ) {

            showToast(
              "تماس رد شد",
              "❌"
            );

            await endCurrentCall(
              true
            );
          }

          if (
            data.status ===
            "ended"
          ) {

            await endCurrentCall(
              true
            );
          }
        }

        if (
          currentCallRole ===
          "callee"
        ) {

          if (
            data.status ===
            "ended"
          ) {

            await endCurrentCall(
              true
            );
          }
        }
      },

      error => {

        console.error(
          "CALL LISTENER ERROR:",
          error
        );

      }
    );
}


/* =========================================================
   CANDIDATES
========================================================= */

function setupCandidateListener(
  collectionName
) {

  if (
    !currentCallId ||
    !diaryId ||
    !peerConnection
  ) {
    return;
  }

  if (unsubscribeCandidates) {

    unsubscribeCandidates();

    unsubscribeCandidates = null;
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
          .forEach(async change => {

            if (
              change.type !==
              "added"
            ) {
              return;
            }

            try {

              const data =
                change.doc.data();

              await peerConnection
                .addIceCandidate(
                  new RTCIceCandidate(
                    data
                  )
                );

            } catch (error) {

              console.error(
                "ADD ICE ERROR:",
                error
              );
            }
          });
      },

      error => {

        console.error(
          "CANDIDATE LISTENER ERROR:",
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
    !currentUser ||
    !diaryId
  ) {
    return;
  }

  if (unsubscribeIncomingCalls) {

    unsubscribeIncomingCalls();

    unsubscribeIncomingCalls = null;
  }

  /*
    فقط تماس‌هایی که callee آن خودمان هستیم.
    نیازی به Composite Index نداریم.
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

        snapshot.docChanges()
          .forEach(change => {

            if (
              change.type !==
              "added"
            ) {
              return;
            }

            const data =
              change.doc.data();

            if (
              data.status !==
              "ringing"
            ) {
              return;
            }

            if (
              data.callerUid ===
              currentUser.uid
            ) {
              return;
            }

            showIncomingCall(
              change.doc.id,
              data
            );
          });
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
  callId,
  data
) {

  if (
    currentCallId &&
    currentCallId !== callId
  ) {
    return;
  }

  pendingIncomingCall = {
    id: callId,
    ...data
  };

  const modal =
    $("incomingCallModal");

  if (!modal) return;

  if ($("incomingCallerName")) {

    $("incomingCallerName")
      .textContent =
      data.callerName ||
      "نفر دیگر";
  }

  if ($("incomingCallType")) {

    $("incomingCallType")
      .textContent =
      data.type === "video"
        ? "تماس تصویری"
        : "تماس صوتی";
  }

  modal.classList.add(
    "show"
  );
}


function hideIncomingCall() {

  const modal =
    $("incomingCallModal");

  if (modal) {

    modal.classList.remove(
      "show"
    );
  }
}


/* =========================================================
   ACCEPT CALL
========================================================= */

async function acceptIncomingCall() {

  const incoming =
    pendingIncomingCall;

  if (!incoming) return;

  if (currentCallId) {

    showToast(
      "در حال حاضر یک تماس فعال است",
      "⚠️"
    );

    return;
  }

  try {

    hideIncomingCall();

    currentCallId =
      incoming.id;

    currentCallType =
      incoming.type;

    currentCallRole =
      "callee";

    micEnabled = false;
    cameraEnabled = false;
    speakerEnabled = true;

    localStream =
      await getLocalMedia(
        currentCallType
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
          incoming.offer
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
          type:
            answer.type,

          sdp:
            answer.sdp
        },

        status:
          "accepted"
      }
    );

    setupCurrentCallListener();

    setupCandidateListener(
      "callerCandidates"
    );

    showCallScreen(
      incoming.callerName ||
      "نفر دیگر",
      incoming.type
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

    await rejectCallById(
      incoming.id
    );

    cleanupCall();

    showToast(
      getMediaErrorMessage(error),
      "❌"
    );
  }
}


/* =========================================================
   REJECT CALL
========================================================= */

async function rejectIncomingCall() {

  const incoming =
    pendingIncomingCall;

  hideIncomingCall();

  pendingIncomingCall =
    null;

  if (!incoming) return;

  await rejectCallById(
    incoming.id
  );
}


async function rejectCallById(
  callId
) {

  if (!callId || !diaryId) return;

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

    console.error(
      "REJECT CALL ERROR:",
      error
    );
  }
}


/* =========================================================
   CALL SCREEN
========================================================= */

function showCallScreen(
  name,
  type
) {

  const screen =
    $("callScreen");

  if (!screen) return;

  screen.classList.add(
    "show"
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

  const remoteVideo =
    $("remoteVideo");

  const localVideo =
    $("localVideo");

  if (type === "video") {

    if (remoteVideo) {

      remoteVideo.style.display =
        "block";
    }

    if (localVideo) {

      localVideo.style.display =
        "block";
    }

  } else {

    if (remoteVideo) {

      remoteVideo.style.display =
        "none";
    }

    if (localVideo) {

      localVideo.style.display =
        "none";
    }
  }
}


function hideCallScreen() {

  const screen =
    $("callScreen");

  if (screen) {

    screen.classList.remove(
      "show"
    );
  }
}


function setCallStatus(
  text
) {

  if ($("callStatus")) {

    $("callStatus").textContent =
      text;
  }
}


/* =========================================================
   CALL CONTROLS
========================================================= */

function toggleMicrophone() {

  if (!localStream) return;

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
}


function toggleCamera() {

  if (!localStream) return;

  const tracks =
    localStream.getVideoTracks();

  if (!tracks.length) {

    showToast(
      "دوربین در این تماس وجود ندارد",
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
}


function toggleSpeaker() {

  speakerEnabled =
    !speakerEnabled;

  const remoteAudio =
    $("remoteAudio");

  if (remoteAudio) {

    remoteAudio.muted =
      !speakerEnabled;
  }

  updateCallButtonsUI();
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


function updateCallTimer() {

  if (!callStartedAt) return;

  const elapsed =
    Math.floor(
      (Date.now() -
        callStartedAt) /
      1000
    );

  const minutes =
    String(
      Math.floor(
        elapsed / 60
      )
    ).padStart(2, "0");

  const seconds =
    String(
      elapsed % 60
    ).padStart(2, "0");

  if ($("callTimer")) {

    $("callTimer").textContent =
      `${minutes}:${seconds}`;
  }
}


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
}


/* =========================================================
   END CALL
========================================================= */

async function endCurrentCall(
  silent = false
) {

  const callId =
    currentCallId;

  if (
    callId &&
    diaryId &&
    !silent
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
          status:
            "ended"
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
}


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

  micEnabled =
    false;

  cameraEnabled =
    false;

  speakerEnabled =
    true;

  hideIncomingCall();

  hideCallScreen();

  updateCallButtonsUI();
}


/* =========================================================
   MEDIA ERROR
========================================================= */

function getMediaErrorMessage(
  error
) {

  const name =
    error?.name || "";

  if (
    name ===
    "NotAllowedError"
  ) {

    return "اجازه دوربین یا میکروفون داده نشده است";
  }

  if (
    name ===
    "NotFoundError"
  ) {

    return "دوربین یا میکروفون پیدا نشد";
  }

  if (
    name ===
    "NotReadableError"
  ) {

    return "دوربین یا میکروفون توسط برنامه دیگری استفاده می‌شود";
  }

  if (
    name ===
    "NotSupportedError"
  ) {

    return "مرورگر از تماس پشتیبانی نمی‌کند";
  }

  if (
    error?.message ===
    "MEDIA_NOT_SUPPORTED"
  ) {

    return "مرورگر از دوربین و میکروفون پشتیبانی نمی‌کند";
  }

  return "برقراری تماس امکان‌پذیر نیست";
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

  try {

    cleanupCall();

    cleanupSubscriptions();

    if (currentUser) {

      const presenceRef =
        ref(
          rtdb,
          `diaries/${diaryId}/presence/${currentUser.uid}`
        );

      try {

        await update(
          presenceRef,
          {
            online: false,
            lastSeen:
              rtdbServerTimestamp()
          }
        );

      } catch {}
    }

    await signOut(auth);

  } catch (error) {

    console.error(
      "LOGOUT ERROR:",
      error
    );

  } finally {

    currentUser =
      null;

    currentName =
      "";

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
  }
}


/* =========================================================
   CLEANUP SUBSCRIPTIONS
========================================================= */

function cleanupSubscriptions() {

  const subscriptions = [
    "unsubscribeMembers",
    "unsubscribeMessages",
    "unsubscribePresence",
    "unsubscribeBattery",
    "unsubscribeIncomingCalls",
    "unsubscribeCurrentCall",
    "unsubscribeCandidates"
  ];

  subscriptions.forEach(
    key => {

      if (
        typeof window[key] ===
        "function"
      ) {
        try {
          window[key]();
        } catch {}
      }
    }
  );

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
   RESTORE SESSION
========================================================= */

async function restoreSession() {

  /*
    کد همیشه ثابت است.
  */

  diaryId =
    FIXED_DIARY_CODE;

  const codeInput =
    $("diaryCode");

  if (codeInput) {

    codeInput.value =
      FIXED_DIARY_CODE;

    codeInput.readOnly =
      true;
  }


  onAuthStateChanged(
    auth,
    async user => {

      if (!user) {

        const savedName =
          localStorage.getItem(
            "sharedDiaryName"
          );

        if (savedName) {

          const nameInput =
            $("userName");

          if (nameInput) {

            nameInput.value =
              savedName;
          }
        }

        return;
      }

      currentUser =
        user;

      const savedName =
        localStorage.getItem(
          "sharedDiaryName"
        );

      /*
        اگر کاربر قبلاً وارد شده باشد،
        نام ذخیره‌شده را برمی‌داریم.
      */

      if (savedName) {

        currentName =
          savedName;

        try {

          const memberRef =
            doc(
              db,
              "diaries",
              diaryId,
              "members",
              currentUser.uid
            );

          const snapshot =
            await getDoc(memberRef);

          if (snapshot.exists()) {

            currentName =
              snapshot.data().name ||
              savedName;

          }

          openApp();

          await setupEverything();

        } catch (error) {

          console.error(
            "RESTORE ERROR:",
            error
          );

          /*
            اگر Session خراب شده،
            صفحه Login را نگه می‌داریم.
          */

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
        }
      }
    }
  );
}


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    /*
      کد دفترچه را خودکار قرار بده.
    */

    const codeInput =
      $("diaryCode");

    if (codeInput) {

      codeInput.value =
        FIXED_DIARY_CODE;

      codeInput.readOnly =
        true;
    }


    const loginBtn =
      $("loginBtn");

    if (loginBtn) {

      loginBtn.onclick =
        login;
    }


    const logoutBtn =
      $("logoutBtn");

    if (logoutBtn) {

      logoutBtn.onclick =
        logout;
    }


    setupCallButtons();

    setupTheme();

    restoreSession();

  }
);
