// admin.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  query,
  orderBy,
  increment,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

/* ========= Firebase config ========= */
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
await setPersistence(auth, browserLocalPersistence);

/* -------------------
   UI helpers
-------------------- */
const navBtns = document.querySelectorAll(".nav-btn");
const views = {
  overview: document.getElementById("overviewView"),
  users: document.getElementById("usersView"),
  referrals: document.getElementById("referralsView"),
  settings: document.getElementById("settingsView")
};
const pageTitle = document.getElementById("pageTitle");
const adminNameEl = document.getElementById("adminName");
const globalSearch = document.getElementById("globalSearch");
const statusFilter = document.getElementById("statusFilter");

navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    navBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const view = btn.dataset.view;
    Object.values(views).forEach(v => v.classList.add("hidden"));
    if (views[view]) views[view].classList.remove("hidden");
    pageTitle.textContent = btn.textContent.trim();
  });
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "affilate-signup.html";
});

/* -------------------
   Auth Guard
-------------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "affilate-signup.html";
    return;
  }

  try {
    const uDoc = await getDoc(doc(db, "users", user.uid));
    if (!uDoc.exists()) {
      alert("Your user profile is missing. Contact support.");
      await signOut(auth);
      window.location.href = "affilate-signup.html";
      return;
    }

    const data = uDoc.data();
    adminNameEl.textContent = data.name ?? user.email;

    if (data.role !== "admin") {
      alert("Access denied — admin only.");
      await signOut(auth);
      window.location.href = "affilate-signup.html";
      return;
    }

    // Start the main listeners AFTER auth validated
    initAdminListeners();
    startReferralCountListener();
  } catch (err) {
    console.error("Auth guard error:", err);
    alert("Error verifying admin. Check console.");
  }
});

/* -------------------
   Realtime listeners (rendering)
-------------------- */
function initAdminListeners() {
  onSnapshot(collection(db, "users"), (snap) => {
    renderUsersTable(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    computeTotals();
  });

  const referralsQuery = query(collection(db, "referrals"), orderBy("createdAt", "desc"));
  onSnapshot(referralsQuery, (snap) => {
    renderReferralsTable(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    computeTotals();
  });
}

/* -------------------
   Safe referral count listener
   - Ensures each referral is counted only once
   - Uses runTransaction + a single update to mark referral counted
   - Does not credit wallet (wallet credit only in markAsPaid)
-------------------- */
function startReferralCountListener() {
  // Listen to referrals collection changes (added)
  onSnapshot(collection(db, "referrals"), async (snap) => {
    snap.docChanges().forEach(async (change) => {
      if (change.type !== "added") return;

      const referralDocId = change.doc.id;
      const refData = change.doc.data();

      // Quickly ignore if no refCode
      if (!refData || !refData.refCode) return;

      try {
        // Use a transaction to avoid race conditions between multiple listeners
        await runTransaction(db, async (tx) => {
          const refDocRef = doc(db, "referrals", referralDocId);
          const refSnap = await tx.get(refDocRef);

          if (!refSnap.exists()) return; // nothing to do
          const r = refSnap.data();

          // If already counted, exit
          if (r.counted) return;

          // find referrer user document (by referralCode)
          // Note: transactions can't perform complex queries reliably across docs/files,
          // so we perform a read outside transaction to find the target user docRef,
          // then do tx.get + tx.update to ensure atomicity of the two updates.
          const usersSnap = await getDocs(collection(db, "users"));
          const refUserDoc = usersSnap.docs.find(u => u.data().referralCode === r.refCode);

          if (!refUserDoc) {
            console.warn(`Referral count: no user found for code=${r.refCode}`);
            // still mark counted to avoid repeated attempts, optionally:
            // await tx.update(refDocRef, { counted: true });
            return;
          }

          const userDocRef = doc(db, "users", refUserDoc.id);

          // Re-get the referral doc inside the transaction to be safe
          const recheckRef = await tx.get(refDocRef);
          if (!recheckRef.exists()) return;
          const recheckData = recheckRef.data();
          if (recheckData.counted) return; // someone else already counted

          // Update user referralCount and mark referral as counted
          tx.update(userDocRef, { referralCount: increment(1) });
          tx.update(refDocRef, { counted: true });

          // transaction returns, commit will apply both updates atomically
        });

        // Optional UI feedback: push a small item at top of recentReferrals
        const recentPanel = document.getElementById("recentReferrals");
        if (recentPanel && refData.referrerName) {
          const n = document.createElement("div");
          n.className = "referral-item";
          n.innerHTML = `
            <div>
              <strong>${escapeHtml(refData.referrerName || refData.refCode)}</strong>
              <div style="font-size:13px;color:var(--muted)">Referral counted (${new Date().toLocaleTimeString()})</div>
            </div>
          `;
          recentPanel.prepend(n);
        }

        console.log(`Referral counted for code=${refData.refCode} (doc=${referralDocId})`);
      } catch (err) {
        console.error("Error counting referral (transaction):", err);
      }
    });
  });
}

/* -------------------
   Render tables
-------------------- */
function renderUsersTable(users) {
  const tbody = document.querySelector("#usersTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(u.name || "")}</td>
      <td>${escapeHtml(u.email || "")}</td>
      <td>${escapeHtml(u.phone || "-")}</td>
      <td>${escapeHtml(u.role || "")}</td>
      <td>${escapeHtml(u.referralCode || "")}</td>
      <td>${u.referralCount || 0}</td>
      <td>₦${(u.walletBalance || 0).toFixed(2)}</td>
      <td>${u.createdAt ? new Date(u.createdAt.seconds ? u.createdAt.seconds * 1000 : u.createdAt).toLocaleString() : "-"}</td>
      <td><button class="btn ghost" data-action="view-user" data-id="${u.id}">View</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-action='view-user']").forEach(btn => {
    btn.addEventListener("click", () => {
      const uid = btn.dataset.id;
      window.open(`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/data/~2Fusers~2F${uid}`, "_blank");
    });
  });
}

function renderReferralsTable(refs) {
  const tbody = document.querySelector("#referralsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const filter = statusFilter?.value || "";
  const search = globalSearch?.value?.toLowerCase?.() || "";

  refs
    .filter(r => {
      if (filter && r.status !== filter) return false;
      if (!search) return true;
      return (
        (r.refCode || "").toLowerCase().includes(search) ||
        (r.clientName || "").toLowerCase().includes(search) ||
        (r.package || "").toLowerCase().includes(search)
      );
    })
    .forEach(r => {
      const tr = document.createElement("tr");
      const amount = r.amount ? `₦${r.amount}` : "₦0";
      const statusClass = r.status === "paid" ? "paid" :
                          r.status === "approved" ? "approved" :
                          "pending";
      tr.innerHTML = `
        <td>${escapeHtml(r.refCode || "")}</td>
        <td>${escapeHtml(r.clientName || "")}</td>
        <td>${escapeHtml(r.package || "")}</td>
        <td>${amount}</td>
        <td><span class="chip ${statusClass}">${escapeHtml(r.status || "pending")}</span></td>
        <td>${r.createdAt ? new Date(r.createdAt.seconds ? r.createdAt.seconds * 1000 : r.createdAt).toLocaleString() : "-"}</td>
        <td>
          <div class="table-actions">
            ${r.status !== "paid"
              ? `<button class="btn" data-action="mark-paid" data-id="${r.id}">Mark as Paid</button>`
              : `<span style="color:green;">✓ Paid</span>`}
            ${r.status !== "approved"
              ? `<button class="btn" data-action="approve" data-id="${r.id}">Approve</button>`
              : `<button class="btn ghost" data-action="revoke" data-id="${r.id}">Revoke</button>`}
            <button class="btn ghost" data-action="view" data-id="${r.id}">View</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll("button[data-action='approve']").forEach(btn =>
    btn.addEventListener("click", () => approveReferral(btn.dataset.id))
  );
  tbody.querySelectorAll("button[data-action='revoke']").forEach(btn =>
    btn.addEventListener("click", () => revokeApproval(btn.dataset.id))
  );
  tbody.querySelectorAll("button[data-action='view']").forEach(btn =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      window.open(`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/data/~2Freferrals~2F${id}`, "_blank");
    })
  );
  tbody.querySelectorAll("button[data-action='mark-paid']").forEach(btn =>
    btn.addEventListener("click", () => markAsPaid(btn.dataset.id))
  );

  // update recent panel (top 5)
  const recentPanel = document.getElementById("recentReferrals");
  if (recentPanel) {
    const top5 = refs.slice(0, 5);
    recentPanel.innerHTML = top5.length
      ? top5.map(r => `
        <div class="referral-item">
          <div>
            <strong>${escapeHtml(r.clientName || "Client")}</strong>
            <div style="color:var(--muted);font-size:13px">${escapeHtml(r.package || "")}</div>
          </div>
          <div style="text-align:right">
            <div>${r.amount ? "₦" + r.amount : "₦0"}</div>
            <div style="font-size:13px;color:var(--muted)">${escapeHtml(r.status || "pending")}</div>
          </div>
        </div>`).join("")
      : `<p style="color:var(--muted)">No referrals yet.</p>`;
  }
}

/* -------------------
   Referral actions
-------------------- */
async function approveReferral(refId) {
  try {
    const rRef = doc(db, "referrals", refId);
    await updateDoc(rRef, { status: "approved", approvedAt: new Date() });
    alert("Referral approved.");
  } catch (err) {
    console.error("Approve error:", err);
    alert("Could not approve referral.");
  }
}

async function revokeApproval(refId) {
  try {
    const rRef = doc(db, "referrals", refId);
    await updateDoc(rRef, { status: "pending" });
    alert("Approval revoked.");
  } catch (err) {
    console.error("Revoke error:", err);
    alert("Could not revoke.");
  }
}

/* -------------------
   Mark as Paid & wallet credit (no referralCount increment here)
-------------------- */
async function markAsPaid(refId) {
  const amount = parseFloat(prompt("Enter amount paid (₦):"));
  if (isNaN(amount) || amount <= 0) return alert("Invalid amount.");

  const reward = amount * 0.2; // 20% commission

  try {
    const rRef = doc(db, "referrals", refId);
    const rSnap = await getDoc(rRef);
    if (!rSnap.exists()) return alert("Referral not found.");

    const refData = rSnap.data();
    await updateDoc(rRef, {
      status: "paid",
      amount,
      reward,
      paidAt: new Date()
    });

    if (refData.refCode) {
      const usersSnap = await getDocs(collection(db, "users"));
      const refUserDoc = usersSnap.docs.find(u => u.data().referralCode === refData.refCode);
      if (refUserDoc) {
        const uRef = doc(db, "users", refUserDoc.id);

        // ONLY credit wallet here
        await updateDoc(uRef, {
          walletBalance: increment(reward)
        });

        console.log(`Referral paid: credited ₦${reward.toFixed(2)} to ${refUserDoc.data().name}`);
      }
    }

    alert(`Referral marked as paid. ₦${reward.toFixed(2)} credited to referrer.`);
    computeTotals();
  } catch (err) {
    console.error("markAsPaid error:", err);
    alert("Error marking as paid. Check console for details.");
  }
}

/* -------------------
   Totals Overview, CSV, Filters, Settings (kept as before)
-------------------- */
function computeTotals() {
  const totalPartners = document.querySelectorAll("#usersTable tbody tr").length;
  const totalReferrals = document.querySelectorAll("#referralsTable tbody tr").length;

  let converted = 0;
  let pendingAmount = 0;

  document.querySelectorAll("#referralsTable tbody tr").forEach(tr => {
    const status = (tr.querySelector(".chip")?.textContent || "").toLowerCase();
    if (status === "paid") converted++;
    if (status === "pending") {
      const amt = tr.cells[3]?.textContent?.replace("₦", "") || "0";
      pendingAmount += parseFloat(amt) || 0;
    }
  });

  document.getElementById("totalPartners").textContent = totalPartners;
  document.getElementById("totalReferrals").textContent = totalReferrals;
  document.getElementById("convertedReferrals").textContent = converted;
  document.getElementById("pendingPayouts").textContent = `₦${pendingAmount.toFixed(2)}`;
}

function tableToCSV(tableEl) {
  const rows = Array.from(tableEl.querySelectorAll("tr"));
  return rows.map(r => {
    const cells = Array.from(r.querySelectorAll("th,td"));
    return cells.map(c => `"${(c.textContent || "").replace(/"/g, '""')}"`).join(",");
  }).join("\n");
}

function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById("exportUsers")?.addEventListener("click", () => {
  const csv = tableToCSV(document.getElementById("usersTable"));
  downloadCSV("bihub_users.csv", csv);
});

document.getElementById("exportReferrals")?.addEventListener("click", () => {
  const csv = tableToCSV(document.getElementById("referralsTable"));
  downloadCSV("bihub_referrals.csv", csv);
});

document.getElementById("exportAll")?.addEventListener("click", () => {
  document.getElementById("exportUsers")?.click();
  setTimeout(() => document.getElementById("exportReferrals")?.click(), 500);
});

globalSearch?.addEventListener("input", computeTotals);
statusFilter?.addEventListener("change", computeTotals);

document.getElementById("saveRedirect")?.addEventListener("click", async () => {
  const target = document.getElementById("redirectTarget").value.trim();
  if (!target) return alert("Enter a redirect URL.");
  try {
    await setDoc(doc(db, "adminSettings", "default"), { referralRedirect: target }, { merge: true });
    alert("Saved.");
  } catch (err) {
    console.error("Save redirect error:", err);
    alert("Could not save setting.");
  }
});

document.getElementById("clearCache")?.addEventListener("click", () => {
  localStorage.removeItem("refCode");
  alert("Local cache cleared.");
});

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
