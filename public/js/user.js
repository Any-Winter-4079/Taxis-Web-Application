if (document.readyState == "loading") {
  document.addEventListener("DOMContentLoaded", ready);
} else {
  ready();
}

// keep track of previous input value:
// when the user submits the form, receives an error,
// and updates / modifies the previous value of an erroneus input field,
// the error is to disappear on the frontend (the goal is not to confuse
// the user into thinking that the newly entered value is also wrong)
var oldTripOrigin = "";
var oldTripDestination = "";
var oldTripDate = "";
var oldTripTime = "";
// keep track of trip's final response
// accepted or rejected -> true
// pending -> false
var tripFinalResponse = false;
// code to keep track of your request's final response
var code;

/* Add event listeners to capture, keep track of,
   and send the information required to request a trip */
function ready() {
  let form = document.getElementById("taxi-request-form");
  let button = document.getElementById("taxi-request");
  let tripOrigin = form.elements["origin"];
  let tripDestination = form.elements["destination"];
  let tripDate = form.elements["date"];
  let tripTime = form.elements["time"];
  tripOrigin.addEventListener("focusout", checkValueChangeOnTripOrigin);
  tripDestination.addEventListener(
    "focusout",
    checkValueChangeOnTripDestination
  );
  tripDate.addEventListener("focusout", checkValueChangeOnTripDate);
  tripTime.addEventListener("focusout", checkValueChangeOnTripTime);
  button.addEventListener("click", function () {
    axios({
      method: "post",
      url: "/request-taxi",
      data: {
        tripOrigin: tripOrigin.value,
        tripDestination: tripDestination.value,
        tripDate: tripDate.value,
        tripTime: tripTime.value,
      },
      headers: { "Content-Type": "application/json" },
    })
      .then(function (response) {
        // if an error is returned, clear the form input and display the returned error message
        if (response.data.errors) {
          if (response.data.errors.tripOriginError) {
            tripOrigin.classList.add("error");
            tripOrigin.value = "";
            tripOrigin.placeholder = response.data.errors.tripOriginError;
          }
          if (response.data.errors.tripDestinationError) {
            tripDestination.classList.add("error");
            tripDestination.value = "";
            tripDestination.placeholder =
              response.data.errors.tripDestinationError;
          }
          if (response.data.errors.tripDateError) {
            tripDate.classList.add("error");
            tripDate.value = "";
            tripDate.placeholder = response.data.errors.tripDateError;
          }
          if (response.data.errors.tripTimeError) {
            tripTime.classList.add("error");
            tripTime.value = "";
            tripTime.placeholder = response.data.errors.tripTimeError;
          }
          if (response.data.errors.tripDateTimeDateError) {
            tripDate.classList.add("error");
            tripDate.value = "";
            tripDate.placeholder = response.data.errors.tripDateTimeDateError;
          }
          if (response.data.errors.tripDateTimeTimeError) {
            tripTime.classList.add("error");
            tripTime.value = "";
            tripTime.placeholder = response.data.errors.tripDateTimeTimeError;
          }
          if (response.data.errors.generalError) {
            tripOrigin.classList.add("error");
            tripDestination.classList.add("error");
            tripDate.classList.add("error");
            tripTime.classList.add("error");
            tripOrigin.value = "";
            tripDestination.value = "";
            tripDate.value = "";
            tripTime.value = "";
            tripOrigin.placeholder = response.data.errors.generalError;
          }
        }
        // if no error is returned, clear form
        else {
          tripOrigin.value = "";
          tripDestination.value = "";
          tripDate.value = "";
          tripTime.value = "";
          document.getElementById("data").innerText =
            response.data.success.status;
          code = response.data.success.code;
          getTripRequestLatestStatus();
        }
      })
      .catch(function (error) {
        // if an exception happens, log it (allows the user
        // to keep his data and retry)
        console.log(error);
      });
  });
}

/* Retrieve latest status of the pending (requested) trip */
function getTripRequestLatestStatus() {
  var interval = setInterval(function () {
    axios({
      method: "get",
      url: "/get-trip-request-status/" + code,
      headers: { "Content-Type": "application/json" },
    })
      .then(function (response) {
        if (response.data.error) {
          document.getElementById("data").innerText = response.data.error;
          clearInterval(interval);
        } else {
          if (response.data.success.isPending == false) {
            if (response.data.success.isValidated == true) {
              document.getElementById("data").innerText =
                "¡Genial, tu taxi con matrícula " +
                response.data.success.licensePlate +
                " está de camino! Se ha enviado una confirmación a tu correo electrónico.";
            } else {
              document.getElementById("data").innerText =
                "¡Vaya! No podemos enviar un taxi a tu punto de recogida en este momento.";
            }
            clearInterval(interval);
          }
        }
      })
      .catch(function (error) {
        document.getElementById("data").innerText =
          "Lo sentimos, se ha producido un error. Inténtalo de nuevo.";
        clearInterval(interval);
      });
  }, 3000);
}

/** Clear error if trip origin input on trip request form is changed after an error */
function checkValueChangeOnTripOrigin() {
  let currentTripOrigin = this.value;
  let form = document.getElementById("taxi-request-form");
  let tripOrigin = form.elements["origin"];
  if (currentTripOrigin != oldTripOrigin) {
    oldTripOrigin = currentTripOrigin;
    tripOrigin.placeholder = "Tomillo 4, 28668 Alcorcón";
    this.classList.remove("error");
  }
}

/** Clear error if trip destination input on trip request form is changed after an error */
function checkValueChangeOnTripDestination() {
  let currentTripDestination = this.value;
  let form = document.getElementById("taxi-request-form");
  let tripDestination = form.elements["destination"];
  if (currentTripDestination != oldTripDestination) {
    oldTripDestination = currentTripDestination;
    tripDestination.placeholder = "Pº Juan XXIII, 11 28040 Madrid";
    this.classList.remove("error");
  }
}

/** Clear error if trip date input on trip request form is changed after an error */
function checkValueChangeOnTripDate() {
  let currentTripDate = this.value;
  let form = document.getElementById("taxi-request-form");
  let tripDate = form.elements["date"];
  if (currentTripDate != oldTripDate) {
    oldTripDate = currentTripDate;
    tripDate.placeholder = "10/02/2022";
    this.classList.remove("error");
  }
}

/** Clear error if trip time input on trip request form is changed after an error */
function checkValueChangeOnTripTime() {
  let currentTripTime = this.value;
  let form = document.getElementById("taxi-request-form");
  let tripTime = form.elements["time"];
  if (currentTripTime != oldTripTime) {
    oldTripTime = currentTripTime;
    tripTime.placeholder = "17:50";
    this.classList.remove("error");
  }
}
