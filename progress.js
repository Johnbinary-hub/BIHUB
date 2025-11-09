// ============================
// PROGRESS.JS — Client Dashboard (Updated)
// ============================

const firebaseConfig = {
  apiKey: "AIzaSyB0FcJizSP2ygEdbN0Sea7FTDeW3fc1Vjg",
  authDomain: "bihub-b1.firebaseapp.com",
  projectId: "bihub-b1",
  storageBucket: "bihub-b1.firebasestorage.app",
  messagingSenderId: "274586741073",
  appId: "1:274586741073:web:767690f96c64537b9e8b70",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const logoutBtn = document.getElementById("logoutBtn");
const requestsList = document.getElementById("requestsList");

// -------------------------
// Logout handler
// -------------------------
logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "login.html";
});

// -------------------------
// Render each request card
// -------------------------
function renderRequest(docId, data) {
  const item = document.createElement("div");
  item.classList.add("request-item");

  const status = data.status || "pending";
  const statusClass =
    status === "approved"
      ? "status-approved"
      : status === "rejected"
      ? "status-rejected"
      : "status-pending";

  item.innerHTML = `
    <div class="request-header">
      <span class="request-title">${data.package || "Service Request"}</span>
      <span class="status-badge ${statusClass}">${status}</span>
    </div>
    <div class="request-details">
      <p><strong>Name:</strong> ${data.clientName || "—"}</p>
      <p><strong>Email:</strong> ${data.clientEmail || "—"}</p>
      <p><strong>Company:</strong> ${data.companyName || "—"}</p>
      <p><strong>Phone:</strong> ${data.clientPhone || "—"}</p>
      <p><strong>Budget:</strong> ${data.budget || "—"}</p>
      <p><strong>Date Submitted:</strong> ${
        data.createdAt
          ? new Date(data.createdAt.toDate()).toLocaleDateString()
          : "—"
      }</p>
    </div>
  `;
  return item;
}

// -------------------------
// Real-time listener for user's requests
// -------------------------
auth.onAuthStateChanged((user) => {
  if (!user) {
    console.warn("⚠️ No user logged in. Redirecting...");
    window.location.href = "login.html";
    return;
  }

  console.log("🔑 Logged in as:", user.email);
  requestsList.innerHTML = "<p class='loading-text'>Fetching your service requests...</p>";

  db.collection("requests")
    .where("clientEmail", "==", user.email)
    // comment out orderBy for now if needed
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snapshot) => {
        console.log("📡 Snapshot received:", snapshot.size);
        requestsList.innerHTML = "";

        if (snapshot.empty) {
          requestsList.innerHTML =
            "<p class='loading-text'>No service requests found.</p>";
          return;
        }

        snapshot.forEach((doc) => {
          console.log("🧾 Request found:", doc.data());
          const data = doc.data();
          const item = renderRequest(doc.id, data);
          requestsList.appendChild(item);
        });
      },
      (error) => {
        console.error("❌ Firestore listener error:", error);
        requestsList.innerHTML = `
          <p style="color:red; text-align:center;">
            Error loading your requests: ${error.message}
          </p>`;
      }
    );
    console.log("🔥 Logged in user:", user ? user.email : "No user logged in");

});
