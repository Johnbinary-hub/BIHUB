import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

/* -------------------
   🔥 Firebase Config
-------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyB0FcJizSP2ygEdbN0Sea7FTDeW3fc1Vjg",
  authDomain: "bihub-b1.firebaseapp.com",
  projectId: "bihub-b1",
  storageBucket: "bihub-b1.firebasestorage.app",
  messagingSenderId: "274586741073",
  appId: "1:274586741073:web:767690f96c64537b9e8b70"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* -------------------
   👤 Partner Dashboard Logic
-------------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html"; // redirect if not logged in
    return;
  }

  // Welcome message
  document.getElementById("welcomeText").textContent = `Welcome back, ${user.displayName || "Partner"}!`;
  document.getElementById("userName").textContent = user.displayName || "Partner";

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();
  if (!userData) return;

  // Show user referral code & link
  document.getElementById("userRef").textContent = userData.referralCode || "N/A";
  const refLinkInput = document.getElementById("refLink");
  if (refLinkInput)
    refLinkInput.value = `${window.location.origin}/index.html?ref=${userData.referralCode}`;

  // Live updates to wallet/referrals
  onSnapshot(userRef, (docSnap) => {
    const u = docSnap.data();
    if (!u) return;

    document.getElementById("walletBalance").textContent = `₦${(u.walletBalance || 0).toLocaleString()}`;
    document.getElementById("commissionEarned").textContent = `₦${(u.walletBalance || 0).toLocaleString()}`;
    document.getElementById("totalReferrals").textContent = u.referralCount || 0;
  });

  // Load referral activity
  const refCode = userData.referralCode;
  if (refCode) {
    const q = query(
      collection(db, "referrals"),
      where("refCode", "==", refCode),
      orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snap) => {
      const referrals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const success = referrals.filter((r) => r.status === "paid" || r.status === "completed");
      const pending = referrals.filter((r) => r.status !== "paid");

      // Stats
      document.getElementById("successfulConversions").textContent = success.length;
      const totalPending = pending.reduce((sum, r) => sum + (r.amount || 0), 0);
      document.getElementById("pendingPayouts").textContent = `₦${totalPending.toLocaleString()}`;

      // Recent referrals list
      const list = document.getElementById("referralsList");
      if (list) {
        list.innerHTML = "";
        if (referrals.length === 0) {
          list.innerHTML = `<p style="color:gray;">No referrals yet...</p>`;
          return;
        }

        referrals.forEach((r) => {
          const div = document.createElement("div");
          div.className = "referral-item";
          div.innerHTML = `
            <p><strong>${r.clientName || "Unnamed Client"}</strong> — ${r.package || "Service"}</p>
            <p>Status: <span class="${r.status === "paid" ? "paid" : "pending"}">${r.status || "pending"}</span></p>
            <p>${r.status === "paid" ? "Earned: ₦" + (r.reward || 0).toLocaleString() : ""}</p>
          `;
          list.appendChild(div);
        });
      }
    });
  }
});

/* -------------------
   🔗 Copy Referral Link
-------------------- */
window.copyLink = function () {
  const refInput = document.getElementById("refLink");
  refInput.select();
  refInput.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(refInput.value);
  alert("Referral link copied!");
};

/* -------------------
   🚪 Logout
-------------------- */
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth)
    .then(() => (window.location.href = "index.html"))
    .catch((err) => console.error("Logout Error:", err));
});
