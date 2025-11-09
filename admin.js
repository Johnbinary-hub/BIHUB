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
  query,
  orderBy,
  increment
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
      window.location.href = "dashboard.html";
      return;
    }

    initAdminListeners();
  } catch (err) {
    console.error("Auth guard error:", err);
    alert("Error verifying admin. Check console.");
  }
});

/* -------------------
   Realtime listeners
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
/* ✅ Real-time listener: auto-credit referrer when a new referral request is created */
onSnapshot(collection(db, "referrals"), async (snap) => {
  snap.docChanges().forEach(async (change) => {
    if (change.type === "added") {
      const ref = change.doc.data();

      // Only process if this referral has a refCode (i.e., came from a referrer)
      if (ref.refCode) {
        const usersSnap = await getDocs(collection(db, "users"));
        const refUser = usersSnap.docs.find(
          (u) => u.data().referralCode === ref.refCode
        );

        if (refUser) {
          const uRef = doc(db, "users", refUser.id);

          /* ------------------------------
             💰 Calculate 20% commission
          ------------------------------ */
          let commission = 0;

          // try to estimate from "budget" or "package"
          if (ref.budget) {
            const budgetText = ref.budget.toLowerCase();
            const match = budgetText.match(/\d+/g);
            if (match) {
              const lastValue = parseInt(match.pop()) * 1000;
              commission = lastValue * 0.2;
            }
          }

          // fallback: flat rate for known packages
          if (!commission && ref.package) {
            const packagePrices = {
              "Web Development": 200000,
              "Graphic Design": 150000,
              "Cybersecurity": 300000,
              "App Development": 250000,
            };
            const basePrice = packagePrices[ref.package] || 100000;
            commission = basePrice * 0.2;
          }

          /* ------------------------------
             ✅ Update referrer's account
          ------------------------------ */
          await updateDoc(uRef, {
            referralCount: increment(1),
            walletBalance: increment(commission),
          });

          console.log(
            `✅ Referrer ${refUser.data().name} credited ₦${commission.toFixed(
              2
            )} (20%)`
          );
        }
      }
    }
  });
});


/* ✅ Add this outside the function */
onSnapshot(collection(db, "referrals"), async (snap) => {
  snap.docChanges().forEach(async (change) => {
    if (change.type === "added") {
      const ref = change.doc.data();
      if (ref.refCode) {
        const usersSnap = await getDocs(collection(db, "users"));
        const refUser = usersSnap.docs.find(u => u.data().referralCode === ref.refCode);
        if (refUser) {
          const uRef = doc(db, "users", refUser.id);
          await updateDoc(uRef, {
            referralCount: increment(1)
          });
          console.log(`✅ Referrer ${refUser.data().name} count incremented`);
        }
      }
    }
  });
});

/* -------------------
   Render tables
-------------------- */
function renderUsersTable(users) {
  const tbody = document.querySelector("#usersTable tbody");
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

  // update recent panel
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

// 💸 Mark referral as paid & credit referrer
async function markAsPaid(refId) {
  const amount = parseFloat(prompt("Enter amount paid (₦):"));
  if (isNaN(amount) || amount <= 0) return alert("Invalid amount.");

  const reward = amount * 0.2; // ✅ 20% commission

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
      const refUser = usersSnap.docs.find(u => u.data().referralCode === refData.refCode);
      if (refUser) {
        const uRef = doc(db, "users", refUser.id);

        // 🔥 Add both wallet credit + live referral count
        await updateDoc(uRef, {
          walletBalance: increment(reward),
          referralCount: increment(1)
        });

        console.log(
          `Referral credited to ${refUser.data().name}: +₦${reward.toFixed(2)}`
        );
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
   Totals Overview
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

/* -------------------
   CSV Export & Misc
-------------------- */
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

document.getElementById("exportUsers").addEventListener("click", () => {
  const csv = tableToCSV(document.getElementById("usersTable"));
  downloadCSV("bihub_users.csv", csv);
});

document.getElementById("exportReferrals").addEventListener("click", () => {
  const csv = tableToCSV(document.getElementById("referralsTable"));
  downloadCSV("bihub_referrals.csv", csv);
});

document.getElementById("exportAll").addEventListener("click", () => {
  document.getElementById("exportUsers").click();
  setTimeout(() => document.getElementById("exportReferrals").click(), 500);
});

/* -------------------
   Filters
-------------------- */
globalSearch.addEventListener("input", computeTotals);
statusFilter.addEventListener("change", computeTotals);

/* -------------------
   Settings
-------------------- */
document.getElementById("saveRedirect").addEventListener("click", async () => {
  const target = document.getElementById("redirectTarget").value.trim();
  if (!target) return alert("Enter a redirect URL.");
  try {
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js");
    await setDoc(doc(db, "adminSettings", "default"), { referralRedirect: target }, { merge: true });
    alert("Saved.");
  } catch (err) {
    console.error("Save redirect error:", err);
    alert("Could not save setting.");
  }
});

document.getElementById("clearCache").addEventListener("click", () => {
  localStorage.removeItem("refCode");
  alert("Local cache cleared.");
});

/* -------------------
   Utils
-------------------- */
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
