// ============================
// SIGNUP.JS — Firebase Signup (Updated)
// ============================

const DEFAULT_REFERRER = "DEFAULT123";

// 🔥 Replace with your Firebase credentials
const firebaseConfig = {
  apiKey: "AIzaSyB0FcJizSP2ygEdbN0Sea7FTDeW3fc1Vjg",
  authDomain: "bihub-b1.firebaseapp.com",
  projectId: "bihub-b1",
  storageBucket: "bihub-b1.firebasestorage.app",
  messagingSenderId: "274586741073",
  appId: "1:274586741073:web:767690f96c64537b9e8b70"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// ✅ Capture referral code from URL if present
const urlParams = new URLSearchParams(window.location.search);
const refCodeFromUrl = urlParams.get("ref");
if (refCodeFromUrl) {
  localStorage.setItem("refCode", refCodeFromUrl);
  document.getElementById("refCode").value = refCodeFromUrl;
}

// Form Elements
const form = document.getElementById("signupForm");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");
const refInput = document.getElementById("refCode");
const useDefault = document.getElementById("useDefaultRef");
const googleBtn = document.getElementById("googleBtn");

// Spinner toggle
function setLoading(isLoading) {
  if (isLoading) {
    submitBtn.classList.add("loading");
    submitBtn.disabled = true;
  } else {
    submitBtn.classList.remove("loading");
    submitBtn.disabled = false;
  }
}

// Autofill referrer code
useDefault.addEventListener("click", () => {
  refInput.value = DEFAULT_REFERRER;
  refInput.focus();
});

// ============================
// Handle Manual Signup
// ============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoading(true);
  statusEl.textContent = "";

  const companyName = form.companyName.value.trim();
  const companyEmail = form.companyEmail.value.trim();
  const phone = form.phone.value.trim();
  const refCode = refInput.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;

  // Validation
  if (!companyName || !companyEmail || !phone || !refCode) {
    statusEl.textContent = "Please fill in all fields.";
    setLoading(false);
    return;
  }
  if (password.length < 8) {
    statusEl.textContent = "Password must be at least 8 characters.";
    setLoading(false);
    return;
  }
  if (password !== confirmPassword) {
    statusEl.textContent = "Passwords do not match.";
    setLoading(false);
    return;
  }

  try {
    // Create Firebase Auth user
    const { user } = await auth.createUserWithEmailAndPassword(companyEmail, password);

    // Save client data under "requests"
    await db.collection("requests").doc(user.uid).set({
      companyName,
      companyEmail,
      phone,
      referrer: refCode,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // ✅ Log referral details under "referrals"
   let referrerName = "Unknown";

// 🧩 Try to find the partner's name using their referral code
if (refCode && refCode !== DEFAULT_REFERRER) {
  const refUserSnap = await db.collection("users").where("referralCode", "==", refCode).get();
  if (!refUserSnap.empty) {
    const refUserData = refUserSnap.docs[0].data();
    referrerName = refUserData.name || "Unnamed Partner";
  }
}

// ✅ Log referral with actual partner name
await db.collection("referrals").add({
  refCode,
  referrerName,
  clientName: companyName,
  clientEmail: companyEmail,
  phone,
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  status: "pending"
});


    // ✅ Increment referral count for partner
    if (refCode && refCode !== DEFAULT_REFERRER) {
      const usersRef = db.collection("users");
      const refSnap = await usersRef.where("referralCode", "==", refCode).get();

      if (!refSnap.empty) {
        const refDoc = refSnap.docs[0];
        await refDoc.ref.update({
          referralCount: firebase.firestore.FieldValue.increment(1)
        });
        console.log(`✅ Referral count increased for ${refCode}`);
      } else {
        console.warn(`⚠️ No partner found for referral code: ${refCode}`);
      }
    }

    // Redirect to dashboard
    window.location.href = "index-dash.html";
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message;
  } finally {
    setLoading(false);
  }
});

// ============================
// Handle Google Sign-In
// ============================
googleBtn.addEventListener("click", async () => {
  statusEl.textContent = "";
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    await db.collection("requests").doc(user.uid).set(
      {
        companyEmail: user.email,
        companyName: user.displayName || "",
        referrer: DEFAULT_REFERRER,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    window.location.href = "index-dash.html";
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message;
  }
});
