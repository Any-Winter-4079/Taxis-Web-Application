if (document.readyState == "loading") {
  document.addEventListener("DOMContentLoaded", ready);
} else {
  ready();
}

// keep track of previous input value:
// when the user / admin submits the form, receives an error,
// and updates / modifies the previous value of an erroneus input field,
// the error is to disappear on the frontend (the goal is not to confuse
// the user into thinking that the newly entered value is also wrong)
var oldRegisterName = "";
var oldRegisterEmail = "";
var oldRegisterMobilePhone = "";
var oldRegisterPassword = "";
var oldRegisterBtcAddress = "";
var oldLoginEmail = "";
var oldLoginPassword = "";

/** Add event listeners for:
    tab change (register or login)
    submission (register or login)
    value change on form input fields
 */
function ready() {
  // tabs
  document
    .getElementById("register-tab-link")
    .addEventListener("click", activate_register_tab);
  document
    .getElementById("login-tab-link")
    .addEventListener("click", activate_login_tab);
  // submissions
  document.getElementById("send-login").addEventListener("click", sendLogin);
  document
    .getElementById("send-register")
    .addEventListener("click", sendRegister);
  // register form input fields
  document
    .getElementById("register-name")
    .addEventListener("focusout", checkValueChangeOnRegisterName);
  document
    .getElementById("register-email")
    .addEventListener("focusout", checkValueChangeOnRegisterEmail);
  document
    .getElementById("register-mobile-phone")
    .addEventListener("focusout", checkValueChangeOnRegisterMobilePhone);
  document
    .getElementById("register-password")
    .addEventListener("focusout", checkValueChangeOnRegisterPassword);
  document
    .getElementById("register-btc-address")
    .addEventListener("focusout", checkValueChangeOnRegisterBtcAddress);
  // login form input fields
  document
    .getElementById("login-email")
    .addEventListener("focusout", checkValueChangeOnLoginEmail);
  document
    .getElementById("login-password")
    .addEventListener("focusout", checkValueChangeOnLoginPassword);
}

/** Change active tab to register */
function activate_register_tab() {
  // 1. change visual cue for active tab
  document.getElementById("register-tab-link").classList.add("active");
  document.getElementById("login-tab-link").classList.remove("active");
  // 2. hide login form and button
  let loginForm = document.getElementsByClassName("login-form")[0];
  loginForm.classList.add("hidden");
  loginForm.nextElementSibling.classList.add("hidden");
  // 3. show register form and button
  let registerForm = document.getElementsByClassName("register-form")[0];
  registerForm.classList.remove("hidden");
  registerForm.nextElementSibling.classList.remove("hidden");
}

/** Change active tab to login */
function activate_login_tab() {
  // 1. change visual cue for active tab
  document.getElementById("login-tab-link").classList.add("active");
  document.getElementById("register-tab-link").classList.remove("active");
  // 2. hide register form and button
  let registerForm = document.getElementsByClassName("register-form")[0];
  registerForm.classList.add("hidden");
  registerForm.nextElementSibling.classList.add("hidden");
  // 3. show login form and button
  let loginForm = document.getElementsByClassName("login-form")[0];
  loginForm.classList.remove("hidden");
  loginForm.nextElementSibling.classList.remove("hidden");
}

/** Send register request to backend:
    if an error is returned (e.g. email is not valid), display it to the user / admin
    if data is correct, activate login tab
 */
function sendRegister() {
  // 1. get form input elements
  let name = document.getElementById("register-name");
  let email = document.getElementById("register-email");
  let mobilePhone = document.getElementById("register-mobile-phone");
  let password = document.getElementById("register-password");
  let btcAddress = document.getElementById("register-btc-address");
  // 2. send request with input values
  axios({
    method: "post",
    url: "/request-register",
    data: {
      name: name.value,
      email: email.value,
      mobilePhone: mobilePhone.value,
      password: password.value,
      btcAddress: btcAddress.value,
    },
    headers: { "Content-Type": "application/json" },
  })
    .then(function (response) {
      // 3. if an error is returned, clear the form input and display the returned error message
      if (response.data.errors) {
        if (response.data.errors.nameError) {
          name.classList.add("error");
          name.value = "";
          name.placeholder = response.data.errors.nameError;
        }
        if (response.data.errors.emailError) {
          email.classList.add("error");
          email.value = "";
          email.placeholder = response.data.errors.emailError;
        }
        if (response.data.errors.emailAlreadyInUseError) {
          email.classList.add("error");
          email.value = "";
          email.placeholder = response.data.errors.emailAlreadyInUseError;
        }
        if (response.data.errors.mobilePhoneError) {
          mobilePhone.classList.add("error");
          mobilePhone.value = "";
          mobilePhone.placeholder = response.data.errors.mobilePhoneError;
        }
        if (response.data.errors.passwordError) {
          password.classList.add("error");
          password.value = "";
          password.placeholder = response.data.errors.passwordError;
        }
        if (response.data.errors.btcAddressError) {
          btcAddress.classList.add("error");
          btcAddress.value = "";
          btcAddress.placeholder = response.data.errors.btcAddressError;
        }
        if (response.data.errors.generalError) {
          name.classList.add("error");
          email.classList.add("error");
          mobilePhone.classList.add("error");
          password.classList.add("error");
          btcAddress.classList.add("error");
          name.value = "";
          email.value = "";
          mobilePhone.value = "";
          password.value = "";
          btcAddress.value = "";
          name.placeholder = response.data.errors.generalError;
        }
      }
      // 4. if no error is returned, activate login tab and clear register form
      else {
        activate_login_tab();
        name.value = "";
        email.value = "";
        mobilePhone.value = "";
        password.value = "";
        btcAddress.value = "";
      }
    })
    .catch(function (error) {
      // 5. if an exception happens, log it
      console.log(error);
    });
}

/** Send login request */
function sendLogin() {
  let email = document.getElementById("login-email");
  let password = document.getElementById("login-password");
  axios({
    method: "post",
    url: "/request-login",
    data: {
      email: email.value,
      password: password.value,
    },
    headers: { "Content-Type": "application/json" },
  })
    .then(function (response) {
      if (response.data.errors) {
        if (response.data.errors.emailError) {
          email.classList.add("error");
          email.value = "";
          email.placeholder = response.data.errors.emailError;
        }
        if (response.data.errors.passwordError) {
          password.classList.add("error");
          password.value = "";
          password.placeholder = response.data.errors.passwordError;
        }
        if (response.data.errors.emailPassCombinationEmailError) {
          email.classList.add("error");
          email.value = "";
          email.placeholder =
            response.data.errors.emailPassCombinationEmailError;
        }
        if (response.data.errors.emailPassCombinationPassError) {
          password.classList.add("error");
          password.value = "";
          password.placeholder =
            response.data.errors.emailPassCombinationPassError;
        }
        if (response.data.errors.generalError) {
          email.classList.add("error");
          password.classList.add("error");
          email.value = "";
          password.value = "";
          email.placeholder = response.data.errors.generalError;
        }
      } else {
        window.location.pathname = response.data.success.redirectRoute;
      }
    })
    .catch(function (err) {
      console.log(err);
    });
}

/** Clear error if name input on register form is changed after an error */
function checkValueChangeOnRegisterName() {
  let currentRegisterName = this.value;
  if (currentRegisterName != oldRegisterName) {
    oldRegisterName = currentRegisterName;
    document.getElementById("register-name").placeholder = "Eduardo";
    this.classList.remove("error");
  }
}

/** Clear error if email input on register form is changed after an error */
function checkValueChangeOnRegisterEmail() {
  let currentRegisterEmail = this.value;
  if (currentRegisterEmail != oldRegisterEmail) {
    oldRegisterEmail = currentRegisterEmail;
    document.getElementById("register-email").placeholder = "example@gmail.com";
    this.classList.remove("error");
  }
}

/** Clear error if mobile phone input on register form is changed after an error */
function checkValueChangeOnRegisterMobilePhone() {
  let currentRegisterMobilePhone = this.value;
  if (currentRegisterMobilePhone != oldRegisterMobilePhone) {
    oldRegisterMobilePhone = currentRegisterMobilePhone;
    document.getElementById("register-mobile-phone").placeholder = "612345678";
    this.classList.remove("error");
  }
}

/** Clear error if password input on register form is changed after an error */
function checkValueChangeOnRegisterPassword() {
  let currentRegisterPassword = this.value;
  if (currentRegisterPassword != oldRegisterPassword) {
    oldRegisterPassword = currentRegisterPassword;
    document.getElementById("register-password").placeholder = "clave";
    this.classList.remove("error");
  }
}

/** Clear error if BTC address input on register form is changed after an error */
function checkValueChangeOnRegisterBtcAddress() {
  let currentRegisterBtcAddress = this.value;
  if (currentRegisterBtcAddress != oldRegisterBtcAddress) {
    oldRegisterBtcAddress = currentRegisterBtcAddress;
    document.getElementById("register-btc-address").placeholder =
      "bc1qj5py7v5j54gpwe25kd6yvypqqnjzmcjr3nsys6";
    this.classList.remove("error");
  }
}

/** Clear error if email input on login form is changed after an error */
function checkValueChangeOnLoginEmail() {
  let currentLoginEmail = this.value;
  if (currentLoginEmail != oldLoginEmail) {
    oldLoginEmail = currentLoginEmail;
    document.getElementById("login-email").placeholder = "example@gmail.com";
    this.classList.remove("error");
  }
}

/** Clear error if password input on login form is changed after an error */
function checkValueChangeOnLoginPassword() {
  let currentLoginPassword = this.value;
  if (currentLoginPassword != oldLoginPassword) {
    oldLoginPassword = currentLoginPassword;
    document.getElementById("login-password").placeholder = "clave";
    this.classList.remove("error");
  }
}
