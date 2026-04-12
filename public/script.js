const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const showLogin = document.getElementById("show-login");
const showSignup = document.getElementById("show-signup");
const formTitle = document.getElementById("form-title");
const messageBox = document.getElementById("message");
const profileBox = document.getElementById("profile-box");
const logoutBtn = document.getElementById("logout-btn");

const profileName = document.getElementById("profile-name");
const profileEmail = document.getElementById("profile-email");
const profilePhone = document.getElementById("profile-phone");

function showMessage(text, type) {
  messageBox.classList.remove("d-none", "alert-success", "alert-danger");
  messageBox.classList.add(type === "success" ? "alert-success" : "alert-danger");
  messageBox.textContent = text;
}

function clearMessage() {
  messageBox.classList.add("d-none");
  messageBox.textContent = "";
}

showLogin.addEventListener("click", () => {
  signupForm.classList.add("d-none");
  loginForm.classList.remove("d-none");
  profileBox.classList.add("d-none");
  formTitle.textContent = "Login";
  clearMessage();
});

showSignup.addEventListener("click", () => {
  loginForm.classList.add("d-none");
  signupForm.classList.remove("d-none");
  profileBox.classList.add("d-none");
  formTitle.textContent = "Create Account";
  clearMessage();
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const phone = document.getElementById("signup-phone").value.trim();
  const password = document.getElementById("signup-password").value.trim();

  if (!name || !email || !phone || !password) {
    return showMessage("Please fill all signup fields", "error");
  }

  if (password.length < 6) {
    return showMessage("Password must be at least 6 characters", "error");
  }

  try {
    const res = await fetch("/user/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, email, phone, password })
    });

    const data = await res.json();

    if (res.ok) {
      showMessage(data.message, "success");
      signupForm.reset();
    } else {
      showMessage(data.message || "Signup failed", "error");
    }
  } catch (error) {
    showMessage("Server error during signup", "error");
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const identifier = document.getElementById("login-identifier").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!identifier || !password) {
    return showMessage("Please fill all login fields", "error");
  }

  try {
    const res = await fetch("/user/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ identifier, password })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem("token", data.token);
      showMessage(data.message, "success");
      loginForm.reset();
      fetchProfile();
    } else {
      showMessage(data.message || "Login failed", "error");
    }
  } catch (error) {
    showMessage("Server error during login", "error");
  }
});

async function fetchProfile() {
  const token = localStorage.getItem("token");

  if (!token) return;

  try {
    const res = await fetch("/user/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (res.ok) {
      signupForm.classList.add("d-none");
      loginForm.classList.add("d-none");
      profileBox.classList.remove("d-none");
      formTitle.textContent = "Welcome";

      profileName.textContent = data.user.name;
      profileEmail.textContent = data.user.email;
      profilePhone.textContent = data.user.phone;
    } else {
      localStorage.removeItem("token");
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
  }
}

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("token");
  profileBox.classList.add("d-none");
  signupForm.classList.remove("d-none");
  formTitle.textContent = "Create Account";
  clearMessage();
});

window.addEventListener("DOMContentLoaded", fetchProfile);