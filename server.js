// development vs. production
if (process.env.NODE_ENV === "production") {
  console.log("Node Environment: Production.");
} else {
  console.log("Node Environment: Development.");
  require("dotenv").config();
}

// environment variables
const sessionSecret = process.env.SESSION_SECRET;
const mongoDBURI = process.env.MONGODB_URI;
const adminEmail = process.env.ADMIN_EMAIL;
const emailPass = process.env.EMAIL_PWD;
const port = process.env.PORT || 3000;
const positionStackAPIKey = process.env.POSITIONSTACK_API_KEY;
let baseUrl;
if (process.env.NODE_ENV === "production") {
  baseUrl = process.env.BASE_URL;
} else {
  baseUrl = "http://localhost:" + port.toString();
}

// require
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const axios = require("axios");
const moment = require("moment");
const nodemailer = require("nodemailer");
const validator = require("email-validator");
const { validate, getAddressInfo } = require("bitcoin-address-validation");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("cookie-session");
const randomToken = require("random-token");

// app
const app = express();
app.enable("trust proxy");
app.set("view engine", "ejs");
app.use(helmet());
app.use(express.json());
app.use(express.static("public"));
app.use(
  session({
    secret: sessionSecret,
    resave: true,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// database
mongoose
  .connect(
    mongoDBURI,
    { useNewUrlParser: true, useUnifiedTopology: true },
    () => {
      console.log("MongoDB: Connected.");
    }
  )
  .catch((err) => console.log("MongoDB: Connection error: " + err.message));
const Schema = mongoose.Schema;
const userSchema = new Schema({
  name: String,
  email: String,
  mobilePhone: String,
  password: String,
  btcAddress: String,
  validationToken: String,
  validationTokenDate: String,
  isValidated: Boolean,
});
const taxiSchema = new Schema({
  currentLocationDescription: String,
  currentLocationLatitude: String,
  currentLocationLongitude: String,
  licensePlate: String,
  destinationDescription: String,
  destinationLatitude: String,
  destinationLongitude: String,
  driverEmail: String,
});
const tripRequestSchema = new Schema({
  originLocationDescription: String,
  destinationLocationDescription: String,
  tripDate: String,
  tripTime: String,
  passengerMobilePhone: String,
  licensePlate: String,
  isValidated: Boolean,
  isPending: Boolean,
});
const adminSchema = new Schema({
  email: String,
  password: String,
});
const User = mongoose.model("user", userSchema); // use the singular version of the MongoDB collection name
const Taxi = mongoose.model("taxi", taxiSchema); // e.g. for "taxis" collection on MongoDB Atlas use "taxi"
const TripRequest = mongoose.model("triprequest", tripRequestSchema);
const Admin = mongoose.model("admin", adminSchema);

// auth
passport.serializeUser((user, done) => {
  return done(null, user.id);
});
passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    if (!user) {
      Admin.findById(id, (error, admin) => {
        done(error, admin);
      });
    } else {
      done(err, user);
    }
  });
});
function preventAdminNotAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.user.email === adminEmail) {
    // do nothing
    return next();
  } else {
    // redirect to register / login if not authenticated
    // on redirect, browser requests page -app.get(...) is called
    res.redirect("/");
  }
}
function preventUserNotAuthenticated(req, res, next) {
  if (req.isAuthenticated() && !(req.user.email === adminEmail)) {
    // do nothing
    return next();
  } else {
    // redirect to register / login if not authenticated
    // on redirect, browser requests page -app.get(...) is called
    res.redirect("/");
  }
}
function forwardAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    // forward to inner page if authenticated
    // on redirect, browser requests page -app.get(...) is called
    if (req.user.email !== adminEmail) {
      res.redirect("/user");
    } else {
      res.redirect("/admin");
    }
  } else {
    // do nothing
    return next();
  }
}
passport.use(
  new LocalStrategy({ usernameField: "email" }, (email, password, done) => {
    // 1. check if email is admin's email
    console.log("Login. Checking if admin is trying to log in...");
    if (email === adminEmail) {
      // 2. if it is admin's email, search for admin in database
      Admin.findOne({ email: email }).then((existingAdmin) => {
        if (!existingAdmin) {
          // 3. if email not found in database, return false
          console.log(
            "Login error. Admin with email " + email + " not found in database."
          );
          return done(null, false);
        } else {
          // 4. if email exists, compare hashed password and entered password w/ bcrypt
          let hashedPassword = existingAdmin.password;
          bcrypt.compare(password, hashedPassword, (err, isSamePassword) => {
            if (err) {
              console.log("Login error. " + err.message);
              return done(null, false);
            } else {
              if (isSamePassword) {
                // 5. if passwords match, return user
                console.log("Login success. Admin: " + existingAdmin);
                return done(null, existingAdmin);
              } else {
                // 6. if passwords do not match, return false
                console.log("Login error. Admin passwords do not match.");
                return done(null, false);
              }
            }
          });
        }
      });
    } else {
      // 7. if email is not admin's email, check if it belongs to a user
      console.log("Login. Checking if user is trying to log in...");
      User.findOne({ email: email }).then((existingUser) => {
        if (!existingUser) {
          // 8. if email not found in database, return false
          console.log(
            "Login error. User with email " + email + " not found in database."
          );
          return done(null, false);
        } else {
          // 9. if email exists, check if user is validated
          if (existingUser.isValidated) {
            // 10. if user is validated, compare hashed password and entered password w/ bcrypt
            let hashedPassword = existingUser.password;
            bcrypt.compare(password, hashedPassword, (err, isSamePassword) => {
              if (err) {
                console.log("Login error. " + err.message);
                return done(null, false);
              } else {
                if (isSamePassword) {
                  // 11. if passwords match, return user
                  console.log("Login success. User: " + existingUser);
                  return done(null, existingUser);
                } else {
                  // 12. if passwords do not match, return false
                  console.log("Login error. Passwords do not match.");
                  return done(null, false);
                }
              }
            });
          } else {
            // 13. if user is not validated, return false
            console.log("Login error. User's email is not validated.");
            return done(null, false);
          }
        }
      });
    }
  })
);
// request register
app.post("/request-register", (req, res) => {
  try {
    const { name, email, mobilePhone, password, btcAddress } = req.body;
    console.log(
      "\nNew register request:" +
        "\nName: " +
        name +
        "\nEmail: " +
        email +
        "\nMobile phone: " +
        mobilePhone +
        "\nPassword: " +
        password +
        "\nbtcAddress: " +
        btcAddress
    );
    let errors = {};
    let errorsFound = false;
    // 1. validate name
    if (name == "") {
      console.log("Register error. Empty name");
      Object.assign(errors, { nameError: "Introduce tu nombre" });
      errorsFound = true;
    }
    // 2. validate email
    if (!validator.validate(email)) {
      console.log("Register error. Invalid email: " + email);
      Object.assign(errors, { emailError: "Introduce un correo válido" });
      errorsFound = true;
    }
    // 3. validate mobile phone
    let stringDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    let validMobilePhone = true;
    if (mobilePhone == "" || mobilePhone.length != 9) {
      validMobilePhone = false;
    } else {
      for (i = 0; i < mobilePhone.length; i++) {
        if (!stringDigits.includes(mobilePhone[i])) {
          validMobilePhone = false;
        }
      }
      if (mobilePhone[0] != "6") {
        validMobilePhone = false;
      }
    }
    if (!validMobilePhone) {
      console.log("Register error. Invalid mobile phone: " + mobilePhone);
      Object.assign(errors, {
        mobilePhoneError: "Introduce un teléfono móvil válido",
      });
      errorsFound = true;
    }
    // 4. validate password
    if (password.length < 6 || password.length > 12) {
      console.log("Register error. Invalid password: " + password);
      Object.assign(errors, {
        passwordError: "Introduce de 6 a 12 caracteres",
      });
      errorsFound = true;
    }
    // 5. validate Bitcoin address (payment)
    if (!validate(btcAddress)) {
      console.log("Register error. Invalid Bitcoin address: " + btcAddress);
      Object.assign(errors, {
        btcAddressError: "Introduce una dirección de Bitcoin válida",
      });
      errorsFound = true;
    }
    // 6. send error message if validation is not passed
    if (errorsFound) {
      res.send({ errors: errors });
    } else {
      // 7. if validation is passed, check email is not already in use by a user
      User.findOne({ email: email }).then((user) => {
        if (user) {
          console.log("Register error. Email is already in use");
          Object.assign(errors, {
            emailAlreadyInUseError: "El correo ya está en uso",
          });
          res.send({ errors: errors });
        } else {
          // 8. if email is not used by any user, check if it's used by the admin
          if (email === adminEmail) {
            console.log("Register error. Email is already in use by an admin");
            Object.assign(errors, {
              emailAlreadyInUseError: "El correo ya está en uso",
            });
            res.send({ errors: errors });
          } else {
            // 9. if email is not used by any user or admin, hash password
            bcrypt.genSalt(10, (err, salt) => {
              if (err) {
                console.log("Register error. Salting error: " + err.message);
                throw err;
              } else {
                bcrypt.hash(password, salt, (err, hashedPassword) => {
                  if (err) {
                    console.log(
                      "Register error. Hashing error: " + err.message
                    );
                    throw err;
                  } else {
                    // 10. generate token for email validation
                    let tokenLength = 32;
                    let token = randomToken(tokenLength);
                    // 11. save user to database
                    new User({
                      name: name,
                      email: email,
                      mobilePhone: mobilePhone,
                      password: hashedPassword,
                      btcAddress: btcAddress,
                      validationToken: token,
                      validationTokenDate: moment().format("DD/MM/YYYY HH:mm"),
                      isValidated: false,
                    })
                      .save()
                      .then((user) => {
                        console.log(
                          "Register success. New user saved to database: " +
                            user
                        );
                        // 12. send verification email
                        let transporter = nodemailer.createTransport({
                          host: "smtp.gmail.com",
                          port: 465,
                          secure: true,
                          auth: {
                            user: adminEmail,
                            pass: emailPass,
                          },
                        });
                        let mailOptions = {
                          from: `"Despacho Taxis" <${adminEmail}>`, // sender address (who sends)
                          to: email, // receivers (who receives, e.g. "a@hotmail.es, b@gmail.com")
                          subject: "Valida tu cuenta en Despacho Taxis", // Subject line
                          text: `¡Bienvenido a Despacho Taxis! Utiliza el siguiente enlace para validar tu cuenta y poder acceder a la aplicación: ${
                            baseUrl + "/validation/" + token
                          }`, // plaintext body
                          html: `<div style="display: flex; flex-direction: column; align-items: center;">
                                  <div style="font-size: 17px; margin: 20px 0; text-align: center;">
                                    ¡Bienvenido a Despacho Taxis!<br>Utiliza el siguiente enlace para validar tu cuenta y poder acceder a la aplicación:
                                  </div>
                                  <div>
                                    <a style="
                                      cursor: pointer;
                                      border: none;
                                      border-radius: 3px;
                                      background-image: linear-gradient(to right, #1bcacd, #15a7d6);
                                      color: white;
                                      font-size: 17px;
                                      font-weight: 100;
                                      padding: 9px;
                                      text-decoration: none;" href="${
                                        baseUrl + "/validation/" + token
                                      }" target="_blank">
                                    Validar</a>
                                  </div>
                                </div>`, // html body
                        };
                        // we could await, but just continue
                        try {
                          // await transporter.sendMail(...);
                          transporter.sendMail(
                            mailOptions,
                            function (error, info) {
                              if (error) {
                                console.log(
                                  "Register error. Nodemailer error:" + error
                                );
                              } else {
                                console.log(
                                  "Register. Validation email successfully sent:"
                                );
                                console.log(info);
                              }
                            }
                          );
                        } catch (e) {
                          console.log(
                            "Register error. Nodemailer exception:" + e
                          );
                        }
                        res.send({ success: {} });
                      })
                      .catch((err) => {
                        console.log(
                          "Register error. Could not save user to database: " +
                            err.message
                        );
                        throw err;
                      });
                  }
                });
              }
            });
          }
        }
      });
    }
  } catch (err) {
    console.log("Register error. " + err.message);
    res.send({ errors: { generalError: "Por favor, inténtalo de nuevo" } });
  }
});
// request login
app.post("/request-login", (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log(
      "\nNew login request:" + "\nEmail: " + email + "\nPassword: " + password
    );
    let errors = {};
    let errorsFound = false;
    // 1. validate email
    if (!validator.validate(email)) {
      console.log("Login error. Invalid email: " + email);
      Object.assign(errors, { emailError: "Introduce un correo válido" });
      errorsFound = true;
    }
    // 2. validate password
    if (password.length < 6 || password.length > 12) {
      console.log("Login error. Invalid password: " + password);
      Object.assign(errors, {
        passwordError: "Introduce de 6 a 12 caracteres",
      });
      errorsFound = true;
    }
    // 3. send error message if validation is not passed
    if (errorsFound) {
      res.send({ errors: errors });
    } else {
      // 4. if validation is passed, check if email corresponds to admin
      let redirectRoute = "";
      if (email === adminEmail) {
        // 5. if admin email, on success redirect to /admin
        redirectRoute = "/admin";
      } else {
        // 6. else, on success redirect to /user
        redirectRoute = "/user";
      }
      // 7. handle authentication attempt
      passport.authenticate("local", function (err, user, info) {
        if (err) {
          throw err;
        } else if (!user) {
          Object.assign(errors, {
            emailPassCombinationEmailError: "Por favor, revisa tus datos",
            emailPassCombinationPassError: "o valida tu cuenta para acceder",
          });
          res.send({ errors: errors });
        } else {
          req.logIn(user, function (err) {
            if (err) {
              throw err;
            } else {
              res.send({ success: { redirectRoute: redirectRoute } });
            }
          });
        }
      })(req, res, next);
    }
  } catch (err) {
    console.log("Login request error. " + err.message);
    res.send({ errors: { generalError: "Por favor, inténtalo de nuevo" } });
  }
});
// validate user's email
app.get("/validation/:token", (req, res) => {
  // 1. search for token in Users collection
  User.findOne({ validationToken: req.params.token })
    .then((user) => {
      if (user) {
        console.log(
          "Validation. Token: " + req.params.token + " belongs to user: " + user
        );
        // 2. if token belongs to a user, check if the user is already validated
        if (user.isValidated) {
          console.log("Validation. The account has already been validated.");
          res.redirect("/");
        } else {
          // 3. if token belongs to a user but is not validated, check if token was created within the last 48 hours
          console.log("Validation. The account is not validated.");
          const currentDate = moment();
          const tokenDate = moment(
            user.validationTokenDate,
            "DD/MM/YYYY HH:mm"
          );
          const hourDiff = moment
            .duration(currentDate.diff(tokenDate))
            .asHours();
          console.log(
            "Validation. The token was created at: " +
              tokenDate.format("DD/MM/YYYY HH:mm") +
              " which is " +
              hourDiff +
              " hours away from today: " +
              currentDate.format("DD/MM/YYYY HH:mm")
          );
          if (hourDiff <= 48) {
            // 4. if the token was created within the last 48 hours, validate user
            user.isValidated = true;
            // await user.save();
            user.save();
            console.log("Validation. The user's account has been validated.");
            res.redirect("/");
          } else {
            // 5. if token is too old, deny validation (should handle it asking user to request new token on register/login screen)
            console.log("Validation. The token has expired.");
            res.redirect("/");
          }
        }
      } else {
        // 6. if the token does not belong to any user, do nothing
        console.log("Validation. Token does not belong to any known user.");
        res.redirect("/");
      }
    })
    .catch((e) => {
      console.log("Validation. Exception: " + e.message);
      res.redirect("/");
    });
});

// home
app.get("/", forwardAuthenticated, (req, res) => {
  // if authenticated, they are forwarded to inner page
  // else, welcome.ejs is rendered (register / login)
  res.render("welcome.ejs");
});

// admin
app.get("/admin", preventAdminNotAuthenticated, (req, res) => {
  // if authenticated, admin.ejs is rendered
  // else, welcome.ejs is rendered (register / login)
  res.render("admin.ejs");
});

// user
app.get("/user", preventUserNotAuthenticated, (req, res) => {
  // if authenticated, user.ejs is rendered
  // else, welcome.ejs is rendered (register / login)
  res.render("user.ejs");
});

// request taxi
app.post("/request-taxi", (req, res) => {
  try {
    const { tripOrigin, tripDestination, tripDate, tripTime } = req.body;
    console.log(
      "Taxi Request:" +
        "\nOrigin: " +
        tripOrigin +
        "\nDestination: " +
        tripDestination +
        "\nDate: " +
        tripDate +
        "\nTime: " +
        tripTime
    );
    let errors = {};
    let errorsFound = false;
    // 1. validate origin
    if (tripOrigin.length == 0) {
      console.log("Taxi Request. Empty trip origin.");
      Object.assign(errors, {
        tripOriginError: "Introduce una dirección de origen",
      });
      errorsFound = true;
    }
    // 2. validate destination
    if (tripDestination.length == 0) {
      console.log("Taxi Request. Empty trip destination.");
      Object.assign(errors, {
        tripDestinationError: "Introduce una dirección de destino",
      });
      errorsFound = true;
    }
    // 3. validate date
    let hasDate = true;
    let allowedDateFormats = [
      "D/M/YYYY",
      "D/MM/YYYY",
      "DD/M/YYYY",
      "DD/MM/YYYY",
    ];
    if (!moment(tripDate, allowedDateFormats, true).isValid()) {
      hasDate = false;
      console.log("Taxi Request. Incorrect trip date format.");
      Object.assign(errors, {
        tripDateError: "Introduce una fecha válida",
      });
      errorsFound = true;
    }
    if (tripDate.length == 0) {
      hasDate = false;
      console.log("Taxi Request. Empty trip date.");
      Object.assign(errors, {
        tripDateError: "Introduce una fecha de viaje",
      });
      errorsFound = true;
    }
    // 4. validate time
    let hasTime = true;
    if (!moment(tripTime, "HH:mm", true).isValid()) {
      hasTime = false;
      console.log("Taxi Request. Incorrect trip time format.");
      Object.assign(errors, {
        tripTimeError: "Introduce una hora válida",
      });
      errorsFound = true;
    }
    if (tripTime.length == 0) {
      hasTime = false;
      console.log("Taxi Request. Empty trip time.");
      Object.assign(errors, {
        tripTimeError: "Introduce una hora de salida",
      });
      errorsFound = true;
    }
    // 5. validate datetime is in the future
    if (hasDate && hasTime) {
      const currentDate = moment();
      const requestedTripDate = moment(
        tripDate + " " + tripTime,
        "DD/MM/YYYY HH:mm"
      );
      const hourDiff = moment
        .duration(requestedTripDate.diff(currentDate))
        .asHours();
      console.log(
        "Taxi Request. The trip is requested for: " +
          requestedTripDate.format("DD/MM/YYYY HH:mm") +
          " which is " +
          hourDiff +
          " hours away from today: " +
          currentDate.format("DD/MM/YYYY HH:mm")
      );
      if (hourDiff < 0) {
        console.log("Taxi Request. Trip datetime is in the past.");
        Object.assign(errors, {
          tripDateTimeDateError: "La fecha y hora están en el pasado",
          tripDateTimeTimeError: "Escoge una fecha en el futuro",
        });
        errorsFound = true;
      }
    }
    // 6. send error message if validation is not passed
    if (errorsFound) {
      res.send({ errors: errors });
    } else {
      // 7. if validation is passed, call API to get origin coordinates from description
      let params = {
        access_key: positionStackAPIKey,
        query: tripOrigin,
      };
      axios
        .get("http://api.positionstack.com/v1/forward", { params })
        .then((response) => {
          const originPrediction = response.data.data[0]; // top predicition for origin
          console.log(
            "Taxi Request. Origin coordinates (lat, long): (" +
              originPrediction.latitude +
              ", " +
              originPrediction.longitude +
              ")"
          );
          // 8. if API call is successful, get destination coordinates from description
          params = {
            access_key: positionStackAPIKey,
            query: tripDestination,
          };
          axios
            .get("http://api.positionstack.com/v1/forward", { params })
            .then((response) => {
              const destinationPrediction = response.data.data[0]; // top predicition for destination
              console.log(
                "Taxi Request. Destination coordinates (lat, long): (" +
                  destinationPrediction.latitude +
                  ", " +
                  destinationPrediction.longitude +
                  ")"
              );
              // 9. calculate closest available taxi to the pick-up point
              let shortestDistance = Infinity;
              let bestTaxi;
              Taxi.find({})
                .then((taxis) => {
                  for (i = 0; i < taxis.length; i++) {
                    let taxi = taxis[i];
                    let distance = calculateDistanceFromLatLong(
                      taxi.currentLocationLatitude,
                      taxi.currentLocationLongitude,
                      originPrediction.latitude,
                      originPrediction.longitude
                    );
                    if (
                      distance < shortestDistance &&
                      taxi.destinationDescription === ""
                    ) {
                      shortestDistance = distance;
                      bestTaxi = taxi;
                    }
                  }
                  bestTaxi.destinationDescription = "pending";
                  bestTaxi.save();
                  console.log(
                    "Taxi Request. The shortest suitable distance found is: " +
                      shortestDistance +
                      " km, from available taxi: " +
                      bestTaxi +
                      "\nto Origin prediction: " +
                      JSON.stringify(originPrediction)
                  );
                  // 10. save taxi request
                  new TripRequest({
                    originLocationDescription: tripOrigin,
                    destinationLocationDescription: tripDestination,
                    tripDate: tripDate,
                    tripTime: tripTime,
                    passengerMobilePhone: req.user.mobilePhone,
                    licensePlate: bestTaxi.licensePlate,
                    isValidated: false,
                    isPending: true,
                  })
                    .save()
                    .then((tripRequest) => {
                      console.log(
                        "Taxi Request. The request has been saved and is pending admin validation. " +
                          tripRequest
                      );
                      res.send({
                        success: {
                          status:
                            "¡Fantástico! Espera unos segundos mientras procesamos tu solicitud...",
                          code: tripRequest._id,
                        },
                      });
                    })
                    .catch((err) => {
                      console.log(
                        "Taxi Request. Error savint trip request to database. Error: " +
                          err.message
                      );
                      throw err;
                    });
                })
                .catch((err) => {
                  console.log(
                    "Taxi Request. Error obtaining taxis from database. Error: " +
                      err.message
                  );
                  throw err;
                });
            })
            .catch((error) => {
              // 10. send error message if API call is unsuccessful
              console.log(
                "Taxi Request. (lat, long) could not be obtained from Destination description: Error: " +
                  error.message
              );
              Object.assign(errors, {
                tripDestinationError: "No se reconoce la dirección",
              });
              res.send({ errors: errors });
            });
        })
        .catch((error) => {
          // 11. send error message if API call is unsuccessful
          console.log(
            "Taxi Request. (lat, long) could not be obtained from Origin description: Error: " +
              error.message
          );
          Object.assign(errors, {
            tripOriginError: "No se reconoce la dirección",
          });
          res.send({ errors: errors });
        });
    }
  } catch (err) {
    // 12. if an exception is thrown, let know an error has occurred in the backend
    console.log("Taxi Request. Error: " + err.message);
    res.send({ errors: { generalError: "Por favor, inténtalo de nuevo" } });
  }
});
function calculateDistanceFromLatLong(
  originLatitude,
  originLongitude,
  destinationLatitude,
  destinationLongitude
) {
  originLatitude = (originLatitude * Math.PI) / 180;
  originLongitude = (originLongitude * Math.PI) / 180;
  destinationLatitude = (destinationLatitude * Math.PI) / 180;
  destinationLongitude = (destinationLongitude * Math.PI) / 180;
  // Haversine
  let a =
    Math.pow(Math.sin((destinationLatitude - originLatitude) / 2), 2) +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.pow(Math.sin((destinationLongitude - originLongitude) / 2), 2);
  let c = 2 * Math.asin(Math.sqrt(a));
  let radius = 6371; // km
  return c * radius;
}

// get trip request latest status
app.get("/get-trip-request-status/:code", (req, res) => {
  TripRequest.findById(req.params.code)
    .then((requestedTrip) => {
      if (!requestedTrip) {
        console.log(
          "Get Trip Request Status. Trip request with id: " +
            req.params.code +
            " does not exist."
        );
        res.send({
          error:
            "¡Vaya! Ha ocurrido un error procesando tu solicitud... Por favor, inténtalo de nuevo.",
        });
      } else {
        res.send({
          success: {
            isValidated: requestedTrip.isValidated,
            isPending: requestedTrip.isPending,
            licensePlate: requestedTrip.licensePlate,
          },
        });
      }
    })
    .catch((err) => {
      console.log("Get Trip Request Status. Exception: " + err.message);
      res.send({
        error:
          "¡Vaya! Ha ocurrido un error procesando tu solicitud... Por favor, inténtalo de nuevo.",
      });
    });
});

// validate (accept or reject) trip
app.post("/validate-trip", (req, res) => {
  try {
    const {
      confirmation,
      tripOrigin,
      tripDestination,
      tripDate,
      tripTime,
      tripPassengerMobilePhone,
      tripLicensePlate,
    } = req.body;
    console.log(
      "\nValidate trip:" +
        "\nAdmin confirmation: " +
        confirmation +
        "\nTrip Origin: " +
        tripOrigin +
        "\nTrip Destination: " +
        tripDestination +
        "\nTrip Date: " +
        tripDate +
        "\nTrip Time: " +
        tripTime +
        "\nTrip Passenger's Mobile phone: " +
        tripPassengerMobilePhone +
        "\nTrip Taxi's License plate: " +
        tripLicensePlate
    );
    // 1. check if the trip is confirmed by the admin
    if (confirmation) {
      console.log("\nValidate trip: The trip has been confirmed by the admin.");
      // 2. if the trip is confirmed, search for the driver's email
      Taxi.findOne({ licensePlate: tripLicensePlate })
        .then((tripTaxi) => {
          // 3. if no taxi (and thus no email) is found with that license plate, notify of the error
          if (!tripTaxi) {
            console.log(
              "\nValidate trip: No taxi has been found with license plate " +
                tripLicensePlate
            );
            res.send({
              error:
                "¡Vaya! Se ha producido un error de comunicación con el taxi",
            });
          }
          // 4. if a taxi (and thus an email) is found, send an email to the driver
          else {
            let driverEmail = tripTaxi.driverEmail;
            let transporter = nodemailer.createTransport({
              host: "smtp.gmail.com",
              port: 465,
              secure: true,
              auth: {
                user: adminEmail,
                pass: emailPass,
              },
            });
            let mailOptions = {
              from: `"Despacho Taxis" <${adminEmail}>`, // sender address (who sends)
              to: driverEmail, // receivers (who receives, e.g. "a@hotmail.es, b@gmail.com")
              subject: "Nuevo viaje confirmado", // Subject line
              text: `¡Enhorabuena! Tienes un nuevo viaje confirmado. Origen: ${tripOrigin}. Destino: ${tripDestination}. Fecha del viaje: ${tripDate}. Hora de salida: ${tripTime}. Móvil de contacto: ${tripPassengerMobilePhone}.`, // plaintext body
              html: `<div>
                      ¡Enhorabuena! Tienes un nuevo viaje confirmado.
                      <br>
                      Origen: ${tripOrigin}.
                      <br>
                      Destino: ${tripDestination}.
                      <br>
                      Fecha del viaje: ${tripDate}.
                      <br>
                      Hora de salida: ${tripTime}.
                      <br>
                      Móvil de contacto: ${tripPassengerMobilePhone}.
                    </div>`, // html body
            };
            try {
              transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                  console.log(
                    "\nValidate trip: Error sending email to taxi's driver using Nodemailer: " +
                      error
                  );
                  res.send({
                    error:
                      "¡Vaya! No se ha podido enviar el correo de confirmación. Tienes la opción de volver a decidir si confirmar o rechazar el viaje.",
                  });
                } else {
                  console.log(
                    "\nValidate trip. Confirmation email successfully sent to the driver:"
                  );
                  console.log(info);
                  // 5. if the email is successfully sent, update the taxi's destination
                  // in fully fledged system, should update coordinates too
                  tripTaxi.destinationDescription = tripDestination;
                  tripTaxi.save();
                  // 6. update the trip request as well (isPending and isValidated)
                  TripRequest.findOne({
                    originLocationDescription: tripOrigin,
                    destinationLocationDescription: tripDestination,
                    tripDate: tripDate,
                    tripTime: tripTime,
                    passengerMobilePhone: tripPassengerMobilePhone,
                    licensePlate: tripLicensePlate,
                  })
                    .then((tripReq) => {
                      if (!tripReq) {
                        console.log("\nValidate trip: Trip request not found.");
                        res.send({
                          err: "¡Vaya! No se ha podido encontrar el viaje en la base de datos de solicitudes de viajes.",
                        });
                      } else {
                        tripReq.isValidated = true;
                        tripReq.isPending = false;
                        tripReq.save();
                        // 7. if the trip request update is successful, search for the passenger's email
                        User.findOne({ mobilePhone: tripPassengerMobilePhone })
                          .then((passenger) => {
                            if (!passenger) {
                              console.log(
                                "\nValidate trip: Passenger not found."
                              );
                              res.send({
                                err: "¡Vaya! No se ha podido encontrar al pasajero en la base de datos.",
                              });
                            } else {
                              // 8. send email confirmation of the trip to the user
                              let passengerEmail = passenger.email;
                              let transporter = nodemailer.createTransport({
                                host: "smtp.gmail.com",
                                port: 465,
                                secure: true,
                                auth: {
                                  user: adminEmail,
                                  pass: emailPass,
                                },
                              });
                              let mailOptions = {
                                from: `"Despacho Taxis" <${adminEmail}>`, // sender address (who sends)
                                to: passengerEmail, // receivers (who receives, e.g. "a@hotmail.es, b@gmail.com")
                                subject: "Nuevo viaje confirmado", // Subject line
                                text: `¡Enhorabuena! Tu taxi está de camino. Origen: ${tripOrigin}. Destino: ${tripDestination}. Fecha del viaje: ${tripDate}. Hora de salida: ${tripTime}. Matrícula: ${tripLicensePlate}.`, // plaintext body
                                html: `<div>
                                        ¡Enhorabuena! Tu taxi está de camino.
                                        <br>
                                        Origen: ${tripOrigin}.
                                        <br>
                                        Destino: ${tripDestination}.
                                        <br>
                                        Fecha del viaje: ${tripDate}.
                                        <br>
                                        Hora de salida: ${tripTime}.
                                        <br>
                                        Matrícula: ${tripLicensePlate}.
                                      </div>`, // html body
                              };
                              try {
                                transporter.sendMail(
                                  mailOptions,
                                  function (error, info) {
                                    if (error) {
                                      console.log(
                                        "\nValidate trip: Error sending trip confirmation to passenger's email using Nodemailer: " +
                                          error
                                      );
                                      // in fully fledged system, should retry. If error persists, finally remove from admin's view
                                      res.send({
                                        err: "¡Vaya! No se ha podido enviar el correo de confirmación al pasajero.",
                                      });
                                    } else {
                                      console.log(
                                        "\nValidate trip. Confirmation email successfully sent to the passenger:"
                                      );
                                      console.log(info);
                                      res.send({ success: "Éxito" });
                                    }
                                  }
                                );
                              } catch (e) {
                                console.log(
                                  "\nValidate trip: Error sending trip confirmation to passenger's email: " +
                                    e
                                );
                                // in fully fledged system, should retry. If error persists, finally remove from admin's view
                                res.send({
                                  err: "¡Vaya! No se ha podido enviar el correo de confirmación al pasajero.",
                                });
                              }
                            }
                          })
                          .catch((e) => {
                            console.log(
                              "\nValidate trip: Error obtaining passenger's email: " +
                                e
                            );
                            // in fully fledged system, should retry. If error persists, finally remove from admin's view
                            res.send({
                              err: "¡Vaya! No se ha podido obtener correctamente el correo del pasajero.",
                            });
                          });
                      }
                    })
                    .catch((error) => {
                      console.log(
                        "\nValidate trip: Error updating trip request information: " +
                          error
                      );
                      // in fully fledged system, should retry. If error persists, finally remove from admin's view
                      res.send({
                        err: "¡Vaya! No se ha podido actualizar correctamente la base de datos de solicitudes de viajes.",
                      });
                    });
                }
              });
            } catch (e) {
              console.log(
                "\nValidate trip: Error sending email to taxi's driver: " + e
              );
              res.send({
                error:
                  "¡Vaya! No se ha podido enviar el correo de confirmación. Tienes la opción de volver a decidir si confirmar o rechazar el viaje.",
              });
            }
          }
        })
        .catch((err) => {
          console.log("Validate trip: Error obtaining driver's email. " + err);
          res.send({
            error:
              "¡Vaya! No se ha podido enviar el correo de confirmación. Tienes la opción de volver a decidir si confirmar o rechazar el viaje.",
          });
        });
    } else {
      console.log("\nValidate trip: The trip has been cancelled by the admin.");
      // 9. if the trip is rejected by the admin, update the trip request (isPending and isValidated)
      TripRequest.findOne({
        originLocationDescription: tripOrigin,
        destinationLocationDescription: tripDestination,
        tripDate: tripDate,
        tripTime: tripTime,
        passengerMobilePhone: tripPassengerMobilePhone,
        licensePlate: tripLicensePlate,
      })
        .then((tripReq) => {
          if (!tripReq) {
            console.log(
              "\nValidate trip: The trip request that the admin rejected was not found on the database."
            );
            res.send({
              err: "¡Vaya! No se ha podido encontrar el viaje rechazado en la base de datos.",
            });
          } else {
            tripReq.isValidated = false;
            tripReq.isPending = false;
            tripReq.save();
            // update taxi's pending status
            Taxi.findOne({ licensePlate: tripLicensePlate })
              .then((tripTaxi) => {
                if (!tripTaxi) {
                  console.log(
                    "\nValidate trip: The taxi assigned to the trip that the admin rejected was not found on the database."
                  );
                  res.send({
                    err: "¡Vaya! No se ha podido encontrar el taxi asignado al viaje rechazado en la base de datos.",
                  });
                } else {
                  tripTaxi.destinationDescription = "";
                  tripTaxi.save();
                  res.send({ success: "Éxito" });
                }
              })
              .catch((e) => {
                console.log(
                  "\nValidate trip: Error taxi searching for the taxi assigned to the trip that the admin rejected." +
                    e
                );
                res.send({
                  err: "¡Vaya! Se ha producido un error al buscar el taxi asignado al viaje rechazado en la base de datos.",
                });
              });
          }
        })
        .catch((err) => {
          console.log(
            "\nValidate trip: Error updating trip request on the database after admin rejection. " +
              err
          );
          res.send({
            err: "¡Vaya! No se ha podido actualizar la base de datos tras rechazar el viaje.",
          });
        });
    }
  } catch (err) {
    console.log("Validate trip: Error. " + err);
    res.send({
      error:
        "¡Vaya! No se ha podido enviar el correo de confirmación. Tienes la opción de volver a decidir si confirmar o rechazar el viaje.",
    });
  }
});

// get trip requests data
app.get("/get-trip-requests-data", (req, res) => {
  // 1. retrieve all trip requests
  TripRequest.find({})
    .then((result) => {
      // 2. send all trip requests
      res.send({ tripRequests: result });
    })
    .catch((error) => {
      // 3. if an exception is thrown, let know an error has occurred in the backend
      console.log(
        "Get Trip Requests. Error retrieving trip requests from MongoDB: " +
          error.message
      );
      res.send({
        error: "¡Vaya! Ha ocurrido un error... Por favor, inténtalo de nuevo.",
      });
    });
});

// get taxis data
app.get("/get-taxis-data", (req, res) => {
  // 1. retrieve all taxis
  Taxi.find({})
    .then((result) => {
      // 2. send all taxis
      res.send({ taxis: result });
    })
    .catch((error) => {
      // 3. if an exception is thrown, let know an error has occurred in the backend
      console.log(
        "Get Taxis. Error retrieving taxis from MongoDB: " + error.message
      );
      res.send({
        error: "¡Vaya! Ha ocurrido un error... Por favor, inténtalo de nuevo.",
      });
    });
});

// listen
app.listen(port);
