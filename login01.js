// login.js
const firebaseConfigLogin = {
  apiKey: "AIzaSyB0FcJizSP2ygEdbN0Sea7FTDeW3fc1Vjg",
  authDomain: "bihub-b1.firebaseapp.com",
  projectId: "bihub-b1",
  storageBucket: "bihub-b1.firebasestorage.app",
  messagingSenderId: "274586741073",
  appId: "1:274586741073:web:767690f96c64537b9e8b70"
};

firebase.initializeApp(firebaseConfigLogin);
const authLogin = firebase.auth();
const providerLogin = new firebase.auth.GoogleAuthProvider();

const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');
const loginGoogleBtn = document.getElementById('loginGoogle');

function setLoginLoading(isLoading){
  if(isLoading){
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
  } else {
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginStatus.textContent = '';
  setLoginLoading(true);

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if(!email || !password){
    loginStatus.textContent = 'Please enter email and password.';
    loginStatus.style.color = 'red';
    setLoginLoading(false);
    return;
  }

  try{
    await authLogin.signInWithEmailAndPassword(email, password);
    loginStatus.textContent = 'Login successful. Redirecting...';
    loginStatus.style.color = 'black';
    setTimeout(()=> window.location.href = 'index-dash.html', 700);
  } catch(err){
    console.error(err);
    loginStatus.textContent = err.message || 'Login failed.';
    loginStatus.style.color = 'red';
  } finally {
    setLoginLoading(false);
  }
});

loginGoogleBtn.addEventListener('click', async () => {
  loginStatus.textContent = '';
  setLoginLoading(true);
  try{
    await authLogin.signInWithPopup(providerLogin);
    loginStatus.textContent = 'Signed in with Google. Redirecting...';
    loginStatus.style.color = 'black';
    setTimeout(()=> window.location.href = 'index-dash.html', 700);
  } catch(err){
    console.error(err);
    loginStatus.textContent = err.message || 'Google sign-in failed.';
    loginStatus.style.color = 'red';
  } finally {
    setLoginLoading(false);
  }
});
