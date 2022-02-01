if (document.readyState == "loading") {
  document.addEventListener("DOMContentLoaded", ready);
} else {
  ready();
}

// divide taxis into 6 groups for pagination
var groupedTaxis = {
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
};
// keep track of pending trip requests
var tripRequests = [];
// and the active trip request index (the index of the
// trip request currently shown to the admin)
var activeTripRequestIndex = 0;

/** Retrieve all taxis, extract their information and
    split them in 6 groups to allow for pagination
    (one group will be rendered; the rest, hidden)
    Retrieve all trip requests, extrac their information
    and display them one by one with pagination */
function ready() {
  // 1. retrieve taxis
  axios({
    method: "get",
    url: "/get-taxis-data",
    headers: { "Content-Type": "application/json" },
  })
    .then(function (response) {
      let taxis = response.data.taxis;
      let pageIndex = 0;
      for (i = 0; i < taxis.length; i++) {
        let taxi = taxis[i];
        let taxiStatus;
        let destinationDescription;
        if (
          taxi.destinationDescription == "" ||
          taxi.destinationDescription == "pending"
        ) {
          taxiStatus = "Libre";
          destinationDescription =
            "Este taxi está libre y por tanto no tiene una ubicación de destino todavía";
        } else {
          taxiStatus = "Ocupado";
          destinationDescription = taxi.destinationDescription;
        }
        // 2. create markup for taxi
        let accordionItem = `<div class="accordion-item">
              <div class="accordion-header taxi-accordion-header" aria-expanded="false">
                  <span>Matrícula ${taxi.licensePlate}</span>
                  <span class="status ${
                    taxiStatus == "Libre" ? "available" : "occupied"
                  }">${taxiStatus}</span>
                  <span><i class="arrow down"></i></span>
              </div>
              <div class="accordion-collapsible">
                  <div class="accordion-collapsible-container">
                      <div><span class="metric-title">Ubicación actual:</span> ${
                        taxi.currentLocationDescription
                      }</div>
                      <div><span class="metric-title">Ubicación de destino:</span> ${destinationDescription}</div>
                  </div>
              </div>
          </div>`;
        // 3. add taxi to group
        groupedTaxis[pageIndex].push(accordionItem);
        // 4. update page index (what group the taxi will be added to)
        let taxiGroupCount = Object.keys(groupedTaxis).length;
        let taxisPerGroup = taxis.length / taxiGroupCount;
        if ((i + 1) % taxisPerGroup == 0) {
          pageIndex++;
        }
      }
      // 5. Render (first) taxi group
      displayTaxiGroup();
      // 6. listen on pagination changes (to change rendered taxi group)
      let taxiGroups = document.getElementsByClassName("taxi-group");
      for (i = 0; i < taxiGroups.length; i++) {
        taxiGroups[i].addEventListener("click", updateTaxiGroup);
      }
    })
    .catch(function (err) {
      let accordionContainer = document.getElementById("accordion-container");
      accordionContainer.innerHTML =
        "¡Vaya! Ha ocurrido un error intentando obtener el listado de taxis... Por favor, inténtalo de nuevo.";
      let numbers = document.getElementById("numbers");
      numbers.classList.add("hidden");
    });
  // 7. update taxis in case a change occurs
  updateTaxis();

  // 8. retrieve trip requests
  axios({
    method: "get",
    url: "/get-trip-requests-data",
    headers: { "Content-Type": "application/json" },
  })
    .then(function (response) {
      tripRequests = [];
      let tripRequestsCount = response.data.tripRequests.length;
      for (i = 0; i < tripRequestsCount; i++) {
        let tripReq = response.data.tripRequests[i];
        if (tripReq.isPending) {
          tripRequests.push(tripReq);
        }
      }
      // 9. create markup for trip request
      if (tripRequests.length == 0) {
        let taxiUserAssignmentContainer = document.getElementById(
          "taxi-user-assignment-container"
        );
        taxiUserAssignmentContainer.innerHTML =
          "<i class='fa fa-trophy'></i> ¡Genial! Parece que no tienes nuevas solicitudes de viaje que atender en estos momentos.<br>Relájate y disfruta revisando las estadísticas de tu flota de taxis mientras llegan nuevas solicitudes de viajes de nuestros clientes.";
        taxiUserAssignmentContainer.classList.add("center960");
        document.getElementById("pending-requests").classList.add("hidden");
        document.getElementById("reject-taxi").classList.add("hidden");
        document.getElementById("confirm-taxi").classList.add("hidden");
      } else {
        let tripRequest = tripRequests[activeTripRequestIndex];
        let taxiUserAssignmentContainer = document.getElementById(
          "taxi-user-assignment-container"
        );
        taxiUserAssignmentContainer.innerHTML = `
      <div class="taxi-user-assignments-header">
        <span>Matrícula ${tripRequest.licensePlate}</span>
        <span class="available">En espera</span>
        <span><i class="fa fa-map-pin"></i></span>
      </div>
      <div><span class="metric-title">Punto de recogida:</span> ${tripRequest.originLocationDescription}</div>
      <div><span class="metric-title">Punto de destino:</span> ${tripRequest.destinationLocationDescription}</div>
      <div><span class="metric-title">Fecha del viaje:</span> ${tripRequest.tripDate}</div>
      <div><span class="metric-title">Hora de salida:</span> ${tripRequest.tripTime}</div>
      <div class="taxi-user-assignment-bottom">
          <div class="taxi-user-assignment-navigation">
              <div class="info" id="back"><span><i class="fa fa-angle-left"></i></span></div>
              <div class="info" id="forward"><span><i class="fa fa-angle-right"></i></span></div>
          </div>
          <div class="info pending"><span>Pago en <i class="fa fa-btc"></i></span></div>
      </div>`;
        document
          .getElementById("forward")
          .addEventListener("click", showNextTripRequest);
        document
          .getElementById("back")
          .addEventListener("click", showPreviousTripRequest);
        document.getElementById("pending-requests").classList.remove("hidden");
        document.getElementById("reject-taxi").classList.remove("hidden");
        document.getElementById("confirm-taxi").classList.remove("hidden");
      }
    })
    .catch(function (err) {
      let taxiUserAssignmentContainer = document.getElementById(
        "taxi-user-assignment-container"
      );
      taxiUserAssignmentContainer.innerHTML =
        "¡Vaya! Ha ocurrido un error intentando obtener el listado de solicitudes de viaje...<br>Por favor, inténtalo de nuevo.";
      taxiUserAssignmentContainer.classList.add("center960");
      let pendingRequests = document.getElementById("pending-requests");
      pendingRequests.classList.add("hidden");
    });

  let confirmTaxiElement = document.getElementById("confirm-taxi");
  let rejectTaxiElement = document.getElementById("reject-taxi");
  confirmTaxiElement.addEventListener("click", validateTrip);
  rejectTaxiElement.addEventListener("click", validateTrip);

  // 10. update trip requests in case a change occurs
  updateTripRequests();
}

/** Validate (confirm or reject) a trip
    that has been assigned to a user,
    and hide the trip request information.
    If no trip request is left pending,
    display notification on the screen
 */
function validateTrip() {
  let confirmation = this.id == "confirm-taxi" ? true : false;
  let tripRequest = tripRequests[activeTripRequestIndex];
  axios({
    method: "post",
    url: "/validate-trip",
    data: {
      confirmation: confirmation,
      tripOrigin: tripRequest.originLocationDescription,
      tripDestination: tripRequest.destinationLocationDescription,
      tripDate: tripRequest.tripDate,
      tripTime: tripRequest.tripTime,
      tripPassengerMobilePhone: tripRequest.passengerMobilePhone,
      tripLicensePlate: tripRequest.licensePlate,
    },
    headers: { "Content-Type": "application/json" },
  })
    .then(function (response) {
      if (response.data.error) {
        document.getElementById("pending-requests").innerHTML =
          response.data.error +
          " con matrícula " +
          tripRequest.licensePlate +
          ".";
      } else {
        document.getElementById("pending-requests").innerHTML =
          "Revisa tus solicitudes pendientes.";
        if (response.data.err) {
          console.log(response.data.err);
        }
        tripRequests.splice(activeTripRequestIndex, 1);
        if (tripRequests.length == 0) {
          activeTripRequestIndex = 0;
          let taxiUserAssignmentContainer = document.getElementById(
            "taxi-user-assignment-container"
          );
          taxiUserAssignmentContainer.innerHTML =
            "<i class='fa fa-trophy'></i> ¡Genial! Parece que no tienes nuevas solicitudes de viaje que atender en estos momentos.<br>Relájate y disfruta revisando las estadísticas de tu flota de taxis mientras llegan nuevas solicitudes de viajes de nuestros clientes.";
          taxiUserAssignmentContainer.classList.add("center960");
          document.getElementById("pending-requests").classList.add("hidden");
          document.getElementById("reject-taxi").classList.add("hidden");
          document.getElementById("confirm-taxi").classList.add("hidden");
        } else {
          if (activeTripRequestIndex != 0) {
            activeTripRequestIndex = activeTripRequestIndex - 1;
          }
        }
      }
    })
    .catch(function (err) {
      console.log(err);
    });
}

/** Display the previous trip request */
function showPreviousTripRequest() {
  if (activeTripRequestIndex > 0) {
    activeTripRequestIndex = activeTripRequestIndex - 1;
    let tripRequest = tripRequests[activeTripRequestIndex];
    let taxiUserAssignmentContainer = document.getElementById(
      "taxi-user-assignment-container"
    );
    taxiUserAssignmentContainer.innerHTML = `
        <div class="taxi-user-assignments-header">
          <span>Matrícula ${tripRequest.licensePlate}</span>
          <span class="available">En espera</span>
          <span><i class="fa fa-map-pin"></i></span>
        </div>
        <div><span class="metric-title">Punto de recogida:</span> ${tripRequest.originLocationDescription}</div>
        <div><span class="metric-title">Punto de destino:</span> ${tripRequest.destinationLocationDescription}</div>
        <div><span class="metric-title">Fecha del viaje:</span> ${tripRequest.tripDate}</div>
        <div><span class="metric-title">Hora de salida:</span> ${tripRequest.tripTime}</div>
        <div class="taxi-user-assignment-bottom">
            <div class="taxi-user-assignment-navigation">
                <div class="info" id="back"><span><i class="fa fa-angle-left"></i></span></div>
                <div class="info" id="forward"><span><i class="fa fa-angle-right"></i></span></div>
            </div>
            <div class="info pending"><span>Pago en <i class="fa fa-btc"></i></span></div>
        </div>`;
    document
      .getElementById("forward")
      .addEventListener("click", showNextTripRequest);
    document
      .getElementById("back")
      .addEventListener("click", showPreviousTripRequest);
    document.getElementById("pending-requests").classList.remove("hidden");
    document.getElementById("reject-taxi").classList.remove("hidden");
    document.getElementById("confirm-taxi").classList.remove("hidden");
  }
}

/** Display the next trip request */
function showNextTripRequest() {
  if (activeTripRequestIndex < tripRequests.length - 1) {
    activeTripRequestIndex = activeTripRequestIndex + 1;
    let tripRequest = tripRequests[activeTripRequestIndex];
    let taxiUserAssignmentContainer = document.getElementById(
      "taxi-user-assignment-container"
    );
    taxiUserAssignmentContainer.innerHTML = `
        <div class="taxi-user-assignments-header">
          <span>Matrícula ${tripRequest.licensePlate}</span>
          <span class="available">En espera</span>
          <span><i class="fa fa-map-pin"></i></span>
        </div>
        <div><span class="metric-title">Punto de recogida:</span> ${tripRequest.originLocationDescription}</div>
        <div><span class="metric-title">Punto de destino:</span> ${tripRequest.destinationLocationDescription}</div>
        <div><span class="metric-title">Fecha del viaje:</span> ${tripRequest.tripDate}</div>
        <div><span class="metric-title">Hora de salida:</span> ${tripRequest.tripTime}</div>
        <div class="taxi-user-assignment-bottom">
            <div class="taxi-user-assignment-navigation">
                <div class="info" id="back"><span><i class="fa fa-angle-left"></i></span></div>
                <div class="info" id="forward"><span><i class="fa fa-angle-right"></i></span></div>
            </div>
            <div class="info pending"><span>Pago en <i class="fa fa-btc"></i></span></div>
        </div>`;
    document
      .getElementById("forward")
      .addEventListener("click", showNextTripRequest);
    document
      .getElementById("back")
      .addEventListener("click", showPreviousTripRequest);
    document.getElementById("pending-requests").classList.remove("hidden");
    document.getElementById("reject-taxi").classList.remove("hidden");
    document.getElementById("confirm-taxi").classList.remove("hidden");
  }
}

/** Retrieve all trip requests, get their
    information and display on screen (if all
    trip requests have already been validated,
    let display notification on screen)
 */
function updateTripRequests() {
  var tripRequestsInterval = setInterval(function () {
    axios({
      method: "get",
      url: "/get-trip-requests-data",
      headers: { "Content-Type": "application/json" },
    })
      .then(function (response) {
        tripRequests = [];
        let tripRequestsCount = response.data.tripRequests.length;
        for (i = 0; i < tripRequestsCount; i++) {
          let tripReq = response.data.tripRequests[i];
          if (tripReq.isPending) {
            tripRequests.push(tripReq);
          }
        }
        if (tripRequests.length == 0) {
          activeTripRequestIndex = 0;
          let taxiUserAssignmentContainer = document.getElementById(
            "taxi-user-assignment-container"
          );
          taxiUserAssignmentContainer.innerHTML =
            "<i class='fa fa-trophy'></i> ¡Genial! Parece que no tienes nuevas solicitudes de viaje que atender en estos momentos.<br>Relájate y disfruta revisando las estadísticas de tu flota de taxis mientras llegan nuevas solicitudes de viajes de nuestros clientes.";
          taxiUserAssignmentContainer.classList.add("center960");
          document.getElementById("pending-requests").classList.add("hidden");
          document.getElementById("reject-taxi").classList.add("hidden");
          document.getElementById("confirm-taxi").classList.add("hidden");
        } else {
          let tripRequest = tripRequests[activeTripRequestIndex];
          let taxiUserAssignmentContainer = document.getElementById(
            "taxi-user-assignment-container"
          );
          taxiUserAssignmentContainer.innerHTML = `
        <div class="taxi-user-assignments-header">
          <span>Matrícula ${tripRequest.licensePlate}</span>
          <span class="available">En espera</span>
          <span><i class="fa fa-map-pin"></i></span>
        </div>
        <div><span class="metric-title">Punto de recogida:</span> ${tripRequest.originLocationDescription}</div>
        <div><span class="metric-title">Punto de destino:</span> ${tripRequest.destinationLocationDescription}</div>
        <div><span class="metric-title">Fecha del viaje:</span> ${tripRequest.tripDate}</div>
        <div><span class="metric-title">Hora de salida:</span> ${tripRequest.tripTime}</div>
        <div class="taxi-user-assignment-bottom">
            <div class="taxi-user-assignment-navigation">
                <div class="info" id="back"><span><i class="fa fa-angle-left"></i></span></div>
                <div class="info" id="forward"><span><i class="fa fa-angle-right"></i></span></div>
            </div>
            <div class="info pending"><span>Pago en <i class="fa fa-btc"></i></span></div>
        </div>`;
          document
            .getElementById("forward")
            .addEventListener("click", showNextTripRequest);
          document
            .getElementById("back")
            .addEventListener("click", showPreviousTripRequest);
          document
            .getElementById("pending-requests")
            .classList.remove("hidden");
          document.getElementById("reject-taxi").classList.remove("hidden");
          document.getElementById("confirm-taxi").classList.remove("hidden");
        }
      })
      .catch(function (err) {
        // you may stop after a # of consecutive errors
        clearInterval(tripRequestsInterval);
      });
  }, 3000);
}

/** Retrieve taxis, get their information
    and display on screen in case a change
    of status, current location or destination happened
 */
function updateTaxis() {
  var updateTaxisinterval = setInterval(function () {
    axios({
      method: "get",
      url: "/get-taxis-data",
      headers: { "Content-Type": "application/json" },
    })
      .then(function (response) {
        let accordionContainer = document.getElementById("accordion-container");
        accordionItems = accordionContainer.children;
        let taxis = response.data.taxis;
        let activeIndex =
          parseInt(document.getElementsByClassName("active")[0].innerText) - 1;
        let taxiGroupCount = Object.keys(groupedTaxis).length;
        let taxisPerGroup = taxis.length / taxiGroupCount;
        for (i = 0; i < taxiGroupCount; i++) {
          if (i != activeIndex) {
            groupedTaxis[i] = [];
          }
          for (j = 0; j < taxisPerGroup; j++) {
            let taxi = taxis[(taxiGroupCount - 1) * i + j];
            let taxiStatus;
            let destinationDescription;
            if (
              taxi.destinationDescription == "" ||
              taxi.destinationDescription == "pending"
            ) {
              taxiStatus = "Libre";
              destinationDescription =
                "Este taxi está libre y por tanto no tiene una ubicación de destino todavía";
            } else {
              taxiStatus = "Ocupado";
              destinationDescription = taxi.destinationDescription;
            }
            if (i == activeIndex) {
              let licensePlateElement =
                accordionItems[j].firstElementChild.firstElementChild;
              let statusElement = licensePlateElement.nextElementSibling;
              let locationsElement =
                accordionItems[j].firstElementChild.nextElementSibling
                  .firstElementChild;
              let currentLocationElement = locationsElement.firstElementChild;
              let destinationLocationElement =
                locationsElement.firstElementChild.nextElementSibling;
              licensePlateElement.innerText = `Matrícula ${taxi.licensePlate}`;
              statusElement.innerText = taxiStatus;
              if (taxiStatus == "Libre") {
                statusElement.classList.add("available");
                statusElement.classList.remove("occupied");
              } else {
                statusElement.classList.add("occupied");
                statusElement.classList.remove("available");
              }
              currentLocationElement.innerHTML = `<span class="metric-title">Ubicación actual:</span> ${taxi.currentLocationDescription}`;
              destinationLocationElement.innerHTML = `<span class="metric-title">Ubicación de destino:</span> ${destinationDescription}`;
            } else {
              let accordionItem = `<div class="accordion-item">
              <div class="accordion-header taxi-accordion-header" aria-expanded="false">
                  <span>Matrícula ${taxi.licensePlate}</span>
                  <span class="status ${
                    taxiStatus == "Libre" ? "available" : "occupied"
                  }">${taxiStatus}</span>
                  <span><i class="arrow down"></i></span>
              </div>
              <div class="accordion-collapsible">
                  <div class="accordion-collapsible-container">
                      <div><span class="metric-title">Ubicación actual:</span> ${
                        taxi.currentLocationDescription
                      }</div>
                      <div><span class="metric-title">Ubicación de destino:</span> ${destinationDescription}</div>
                  </div>
              </div>
          </div>`;
              groupedTaxis[i].push(accordionItem);
            }
          }
        }
      })
      .catch(function (err) {
        console.log(err);
        // you may stop after a # of consecutive errors
        clearInterval(updateTaxisinterval);
      });
  }, 3000);
}

/** Render the chosen group of taxis (out of the 6 groups
    available via pagination) or the first group by default  */
function displayTaxiGroup() {
  let accordionContainer = document.getElementById("accordion-container");
  // 1. get active group index
  let activeIndex =
    parseInt(document.getElementsByClassName("active")[0].innerText) - 1;
  accordionContainer.innerHTML = "";
  for (i = 0; i < groupedTaxis[activeIndex].length; i++) {
    // 2. update display showing all taxis from the active group
    accordionContainer.innerHTML += groupedTaxis[activeIndex][i];
  }
  // 3. activate event listeners for hover (to display staxi tatus)
  // and click (to display taxi info) for the newly rendered taxis
  activateTaxiListeners();
}

/** Activate hover and click event listeners for the rendered taxis */
function activateTaxiListeners() {
  let accordionHeaders = document.getElementsByClassName(
    "taxi-accordion-header"
  );
  for (i = 0; i < accordionHeaders.length; i++) {
    // 1. add event listener to toggle (expand/collapse) taxi info
    accordionHeaders[i].addEventListener("click", toggleInfo);
    // 2. add event listener to display taxi status (available/occupied)
    accordionHeaders[i].addEventListener("mouseover", displayStatus);
    // 3. add event listener to hide taxi status (available/occupied)
    accordionHeaders[i].addEventListener("mouseout", hideStatus);
  }
}

/** Hide all taxi groups except for the group the user selected */
function updateTaxiGroup() {
  let taxiGroups = document.getElementsByClassName("taxi-group");
  for (i = 0; i < taxiGroups.length; i++) {
    // 1. hide taxi group
    taxiGroups[i].classList.remove("active");
  }
  // 2. display selected taxi group
  this.classList.add("active");
  displayTaxiGroup();
}

/** Collapse all taxis except the clicked one:
 *  If the clicked taxi was collapsed, expand it.
 *  If the clicked taxi was expanded, collapse it */
function toggleInfo() {
  let accordionHeaders = document.getElementsByClassName(
    "taxi-accordion-header"
  );
  // 1. obtain the clicked taxi toggle status (collapsed or expanded)
  let preClickState = this.getAttribute("aria-expanded");
  for (i = 0; i < accordionHeaders.length; i++) {
    let accordionHeader = accordionHeaders[i];
    // 2. collapse every taxi
    accordionHeader.setAttribute("aria-expanded", "false");
    // 3. hide the status of every taxi
    accordionHeader.firstElementChild.nextElementSibling.style.opacity = "0";
    // 4. invert expand arrow
    accordionHeader.firstElementChild.nextElementSibling.nextElementSibling.firstElementChild.classList.remove(
      "up"
    );
    accordionHeader.firstElementChild.nextElementSibling.nextElementSibling.firstElementChild.classList.add(
      "down"
    );
  }
  if (preClickState == "false") {
    // 5. only if the clicked taxi was collapsed, expand it
    this.setAttribute("aria-expanded", "true");
    // 6. and invert the expand arrow
    this.firstElementChild.nextElementSibling.nextElementSibling.firstElementChild.classList.add(
      "up"
    );
    // 7. display taxi status
    this.firstElementChild.nextElementSibling.style.opacity = "1";
  }
}

/** Display taxi status */
function displayStatus() {
  // 1. Make taxi status visible
  this.firstElementChild.nextElementSibling.style.opacity = "1";
}

/** Hide taxi status */
function hideStatus() {
  // 1. obtain the clicked taxi toggle status (collapsed or expanded)
  let preHoverState = this.getAttribute("aria-expanded");
  // 2. only if the hovered out taxi is not expanded, hide status
  if (preHoverState == "false") {
    this.firstElementChild.nextElementSibling.style.opacity = "0";
  }
}
