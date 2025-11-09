import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

/* Firebase Config */
const firebaseConfig = {
  apiKey: "AIzaSyB0FcJizSP2ygEdbN0Sea7FTDeW3fc1Vjg",
  authDomain: "bihub-b1.firebaseapp.com",
  projectId: "bihub-b1",
  storageBucket: "bihub-b1.firebasestorage.app",
  messagingSenderId: "274586741073",
  appId: "1:274586741073:web:767690f96c64537b9e8b70",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const requestList = document.getElementById("requestList");
const tableBody = document.getElementById("requestTable").querySelector("tbody");

// Initial loading message
tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Loading requests...</td></tr>`;

// Real-time listener
const q = query(collection(db, "requests"), orderBy("createdAt", "desc"));
console.log("✅ Admin dashboard connected to Firestore...");

onSnapshot(
  q,
  (snapshot) => {
    console.log("📡 Data snapshot received:", snapshot.size);
    requestList.innerHTML = "";

    if (snapshot.empty) {
      requestList.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; color:#888;">No requests found</td>
        </tr>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const date = data.createdAt?.seconds
        ? new Date(data.createdAt.seconds * 1000).toLocaleString()
        : "—";

      const statusColor =
        data.status === "approved"
          ? "green"
          : data.status === "rejected"
          ? "red"
          : "#777";

      requestList.innerHTML += `
        <tr data-id="${docSnap.id}">
          <td>${data.clientName}</td>
          <td>${data.clientEmail}</td>
          <td>${data.package}</td>
          <td>${data.budget || "N/A"}</td>
          <td style="color:${statusColor}; font-weight:600;">${data.status}</td>
          <td>${date}</td>
          <td>
            <button class="approve-btn">Approve</button>
            <button class="reject-btn">Reject</button>
          </td>
        </tr>
      `;
    });

    attachActionHandlers();
  },
  (error) => {
    console.error("❌ Firestore listener error:", error);
    requestList.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; color:red;">
          Error loading data: ${error.message}
        </td>
      </tr>`;
  }
);

/* -----------------------------
   Attach Approve / Reject events
------------------------------ */
function attachActionHandlers() {
  document.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const requestId = row.getAttribute("data-id");
      const confirmed = confirm("Approve this request?");
      if (confirmed) await updateStatus(requestId, "approved");
    });
  });

  document.querySelectorAll(".reject-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const requestId = row.getAttribute("data-id");
      const confirmed = confirm("Reject this request?");
      if (confirmed) await updateStatus(requestId, "rejected");
    });
  });
}

/* -----------------------------
   Update Firestore request status
------------------------------ */
async function updateStatus(requestId, newStatus) {
  try {
    const ref = doc(db, "requests", requestId);
    await updateDoc(ref, { status: newStatus });
    alert(`✅ Request ${newStatus} successfully!`);
  } catch (error) {
    console.error("Error updating status:", error);
    alert("Error updating request status.");
  }
}
