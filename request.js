import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js";

/* ========= Firebase config ========= */
const firebaseConfig = {
  apiKey: "AIzaSyB0FcJizSP2ygEdbN0Sea7FTDeW3fc1Vjg",
  authDomain: "bihub-b1.firebaseapp.com",
  projectId: "bihub-b1",
  storageBucket: "bihub-b1.firebasestorage.app",
  messagingSenderId: "274586741073",
  appId: "1:274586741073:web:767690f96c64537b9e8b70",
};
/* =================================== */

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
await setPersistence(auth, browserLocalPersistence);

const form = document.getElementById("requestForm");
const fileInput = document.getElementById("fileUpload");
const loader = document.getElementById("loader");

/* -------------------
   Auth Modal controls
-------------------- */
const authModal = document.getElementById("authModal");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const toggleAuth = document.getElementById("toggleAuth");
const authExtraFields = document.getElementById("authExtraFields");
let isSignup = false;

toggleAuth.addEventListener("click", (e) => {
  e.preventDefault();
  isSignup = !isSignup;
  if (isSignup) {
    authTitle.textContent = "Create an Account";
    authExtraFields.classList.remove("hidden");
    document.getElementById("authBtn").textContent = "Sign Up";
    toggleAuth.textContent = "Login";
  } else {
    authTitle.textContent = "Login to Continue";
    authExtraFields.classList.add("hidden");
    document.getElementById("authBtn").textContent = "Login";
    toggleAuth.textContent = "Sign Up";
  }
});

/* -------------------
   Submit Request
-------------------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const requestData = {
    clientName: form.clientName.value.trim(),
    clientEmail: form.clientEmail.value.trim(),
    clientPhone: form.clientPhone.value.trim(),
    companyName: form.companyName.value.trim(),
    package: form.package.value.trim(),
    description: form.description.value.trim(),
    budget: form.budget.value.trim(),
    meetingDate: form.meetingDate.value || "",
    fileURL: "",
  };

  if (!requestData.clientName || !requestData.clientEmail || !requestData.package) {
    alert("Please fill all required fields.");
    return;
  }

  const file = fileInput.files[0];
  if (file) {
    const fileRef = ref(storage, `requests/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    requestData.fileURL = await getDownloadURL(fileRef);
  }

  const user = auth.currentUser;
  if (!user) {
    localStorage.setItem("pendingRequest", JSON.stringify(requestData));
    authModal.classList.remove("hidden");
    return;
  }

  showLoader(true);
  await saveRequest(user.uid, requestData);
  showLoader(false);
});

/* -------------------
   Save Request to Firestore
-------------------- */
async function saveRequest(uid, requestData) {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const refCode = userData.referredBy || "";

    await addDoc(collection(db, "requests"), {
      ...requestData,
      refCode,
      userId: uid,
      status: "pending",
      amount: 0,
      createdAt: serverTimestamp(),
    });

    alert("✅ Request submitted successfully!");
    localStorage.removeItem("pendingRequest");
    form.reset();
    authModal.classList.add("hidden");

    showLoader(true);
    setTimeout(() => (window.location.href = "index-dash.html"), 1200);
  } catch (err) {
    console.error("Error saving request:", err);
    alert("Something went wrong while submitting your request.");
  }
}

/* -------------------
   Auth Modal Submission
-------------------- */
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value.trim();

  try {
    let userCred;
    if (isSignup) {
      const name = document.getElementById("signupName").value.trim();
      const company = document.getElementById("signupCompany").value.trim();

      userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, { displayName: name });

      await setDoc(doc(db, "users", userCred.user.uid), {
        name,
        company,
        email,
        role: "user",
        walletBalance: 0,
        referralCount: 0,
        createdAt: serverTimestamp(),
      });
    } else {
      userCred = await signInWithEmailAndPassword(auth, email, password);
    }

    const savedRequest = localStorage.getItem("pendingRequest");
    if (savedRequest) {
      showLoader(true);
      await saveRequest(userCred.user.uid, JSON.parse(savedRequest));
      showLoader(false);
    }
  } catch (err) {
    console.error("Auth error:", err);
    alert("Error: " + err.message);
  }
});

/* -------------------
   Auto submit saved request after login
-------------------- */
onAuthStateChanged(auth, async (user) => {
  const savedRequest = localStorage.getItem("pendingRequest");
  if (user && savedRequest) {
    await saveRequest(user.uid, JSON.parse(savedRequest));
  }
});

/* -------------------
   Loader control
-------------------- */
function showLoader(show) {
  if (!loader) return;
  if (show) loader.classList.remove("hidden");
  else loader.classList.add("hidden");
}
