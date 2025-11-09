import {
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

await setPersistence(auth, browserLocalPersistence);

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  collection,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

/* ========= Firebase Config ========= */
const firebaseConfig = {
   apiKey: "AIzaSyB0FcJizSP2ygEdbN0Sea7FTDeW3fc1Vjg",
  authDomain: "bihub-b1.firebaseapp.com",
  projectId: "bihub-b1",
  storageBucket: "bihub-b1.firebasestorage.app",
  messagingSenderId: "274586741073",
  appId: "1:274586741073:web:767690f96c64537b9e8b70"
};
/* =================================== */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* --- Auto-fill referral code if link has ?ref= --- */
const params = new URLSearchParams(window.location.search);
const refCodeFromURL = params.get("ref");
if (refCodeFromURL) {
  document.getElementById("referralCode").value = refCodeFromURL;
}

/* --- Signup Logic --- */
document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const company = document.getElementById("company").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const heardFrom = document.getElementById("heardFrom").value.trim();
  const referralCodeInput = document.getElementById("referralCode").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!name || !email || !password) {
    alert("Please fill all required fields.");
    return;
  }

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    await updateProfile(user, { displayName: name });

    // Generate user's personal referral code
    const personalRefCode = name.split(" ")[0].toLowerCase() + Math.floor(1000 + Math.random() * 9000);

    // Save user data to Firestore
    await setDoc(doc(db, "users", user.uid), {
      name,
      company,
      email,
      phone,
      address,
      heardFrom,
      referralCode: personalRefCode,
      referredBy: referralCodeInput || null,
      role: "user",
      walletBalance: 0,
      referralCount: 0,
      createdAt: serverTimestamp()
    });

    // Update the referrer's count if referralCode was used
    if (referralCodeInput) {
      const usersSnap = await getDocs(collection(db, "users"));
      const refUser = usersSnap.docs.find(u => u.data().referralCode === referralCodeInput);
      if (refUser) {
        await updateDoc(doc(db, "users", refUser.id), {
          referralCount: increment(1)
        });
      }
    }

    alert("Signup successful! Redirecting to request page...");
    navigateWithLoader("index-dash.html");

  } catch (err) {
    console.error("Signup error:", err);
    alert("Signup failed: " + err.message);
  }
});
