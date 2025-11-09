import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

/* ------------------ 🔹 Firebase Setup ------------------ */
const firebaseConfig = {
   apiKey: "AIzaSyB0FcJizSP2ygEdbN0Sea7FTDeW3fc1Vjg",
  authDomain: "bihub-b1.firebaseapp.com",
  projectId: "bihub-b1",
  storageBucket: "bihub-b1.firebasestorage.app",
  messagingSenderId: "274586741073",
  appId: "1:274586741073:web:767690f96c64537b9e8b70"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
await setPersistence(auth, browserLocalPersistence);

/* ------------------ 🔹 Helpers ------------------ */
function generateRef(name) {
  const base = (name.split(" ")[0] || "USER").toUpperCase();
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${base}-${num}`;
}
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 3000);
}
function switchTo(tab) {
  const s = document.getElementById("signupPanel");
  const l = document.getElementById("loginPanel");
  if (tab === "signup") { s.classList.remove("hidden"); l.classList.add("hidden"); }
  else { l.classList.remove("hidden"); s.classList.add("hidden"); }
}
document.getElementById("signupTab").addEventListener("click", () => switchTo("signup"));
document.getElementById("loginTab").addEventListener("click", () => switchTo("login"));
document.getElementById("toLogin").addEventListener("click", () => switchTo("login"));
document.getElementById("toSignup").addEventListener("click", () => switchTo("signup"));

/* ------------------ 🔹 Signup ------------------ */
document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirmPassword").value;
  const role = document.getElementById("role").value;
  if (!fullName || !email || !password || password !== confirm || !role) {
    showToast("Please complete all fields correctly");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const referredBy = localStorage.getItem("refCode") || null;
    const referralCode = generateRef(fullName);

   await setDoc(doc(db, "users", cred.user.uid), {
  name: fullName,
  email,
  phone: document.getElementById("number").value.trim(),
  role,
  referralCode,
  referredBy,
  walletBalance: 0,
  referralCount: 0,
  createdAt: new Date()
});

    // record referral if exists
    if (referredBy) {
      const refCol = collection(db, "referrals");
      await setDoc(doc(refCol), {
        referredBy,
        newUser: fullName,
        newUserEmail: email,
        createdAt: new Date()
      });
    }

    showToast("Account created!");
    window.location.href = role === "admin" ? "admin.html" : "dashboard.html";
  } catch (err) {
    showToast(err.message);
  }
});

/* ------------------ 🔹 Login ------------------ */
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.exists()) return showToast("User profile not found");
    const role = snap.data().role;
    window.location.href = role === "admin" ? "admin.html" : "dashboard.html";
  } catch (err) { showToast(err.message); }
});

/* ------------------ 🔹 Google Sign-in ------------------ */
document.getElementById("googleSignup").addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const referredBy = localStorage.getItem("refCode") || null;

    if (!snap.exists()) {
      await setDoc(userRef, {
        name: user.displayName,
        email: user.email,
        role: "Partner",
        referralCode: generateRef(user.displayName),
        referredBy,
        createdAt: new Date()
      });
      if (referredBy) {
        const refCol = collection(db, "referrals");
        await setDoc(doc(refCol), {
          referredBy,
          newUser: user.displayName,
          newUserEmail: user.email,
          createdAt: new Date()
        });
      }
    }

    const data = (await getDoc(userRef)).data();
    window.location.href = data.role === "admin" ? "admin.html" : "dashboard.html";
  } catch (err) { showToast(err.message); }
});
