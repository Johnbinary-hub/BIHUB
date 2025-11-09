// ============================
// LOGIN.JS — Firebase Login
// ============================

// 🔥 Replace with your Firebase credentials
const firebaseConfig = {
   apiKey: "AIzaSyB0FcJizSP2ygEdbN0Sea7FTDeW3fc1Vjg",
  authDomain: "bihub-b1.firebaseapp.com",
  projectId: "bihub-b1",
  storageBucket: "bihub-b1.firebasestorage.app",
  messagingSenderId: "274586741073",
  appId: "1:274586741073:web:767690f96c64537b9e8b70"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// Form elements
const form = document.getElementById("loginForm");
const statusEl = document.getElementById("status");
const loginBtn = document.getElementById("loginBtn");
const googleBtn = document.getElementById("googleLogin");

// Spinner control
function setLoading(isLoading) {
  if (isLoading) {
    loginBtn.classList.add("loading");
    loginBtn.disabled = true;
  } else {
    loginBtn.classList.remove("loading");
    loginBtn.disabled = false;
  }
}

// Email login
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoading(true);
  statusEl.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await auth.signInWithEmailAndPassword(email, password);
    window.location.href = "index-dash.html";
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message;
  } finally {
    setLoading(false);
  }
});

// Google login
googleBtn.addEventListener("click", async () => {
  try {
    await auth.signInWithPopup(provider);
    window.location.href = "index-dash.html";
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message;
  }
});
