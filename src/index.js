const express = require("express");
const passport = require("passport");
const cookieSession = require("cookie-session");
require("./passport");
const jwt = require("jsonwebtoken");

const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize("sqlite::memory:");

const { Albums } = require("./albums/domain");

const app = express();

app.use(express.json());

//Configure Session Storage
app.use(
  cookieSession({
    name: "session-name",
    keys: ["key1", "key2"],
  })
);

//Configure Passport
app.use(passport.initialize());
app.use(passport.session());

//Unprotected Routes
app.get("/", (req, res) => {
  res.send("<h1>Home</h1>");
});

app.get("/failed", (req, res) => {
  res.send("<h1>Log in Failed :(</h1>");
});

// Middleware - Check user is Logged in
const checkUserLoggedIn = (req, res, next) => {
  req.user ? next() : res.sendStatus(401);
};

function verifyJWT(req, res, next) {
  const token = req.headers["x-access-token"] || req.user.jwt;
  if (!token)
    return res.status(401).json({ auth: false, message: "No token provided." });

  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    if (err)
      return res
        .status(500)
        .json({ auth: false, message: "Failed to authenticate token." });

    req.user = jwt.decode(token, process.env.JWT_SECRET).data;
    next();
  });
}

//Protected Route.
app.get("/profile", checkUserLoggedIn, (req, res) => {
  res.send(`<h1>${req.user.displayName}'s Profile Page</h1>
<br>
<b>Email:</b> ${req.user.emails[0].value}
<br>
<b>JWT:</b> <br> ${req.user.jwt}
`);
});

// Auth Routes
app.get(
  "/login",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/failed" }),
  function (req, res) {
    console.log(req.user);
    req.user.jwt = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
        data: req.user,
      },
      process.env.JWT_SECRET
    );
    res.redirect("/profile");
  }
);

//Logout
app.get("/logout", (req, res) => {
  req.session = null;
  req.logout();
  res.redirect("/");
});

app.post("/album", verifyJWT, async (req, res) => {
  const email = req.user.emails[0].value;
  const { title, artist } = req.body;
  const album = await Albums.create({
    title,
    artist,
    user: email,
  });
  res.status(200).json({ album });
});

app.get("/albums", verifyJWT, async (req, res) => {
  const email = req.user.emails[0].value;
  const albums = await Albums.findAll({
    where: {
      user: email,
    },
  });
  res.status(200).json({ albums });
});

const init = async () => {
  await sequelize.sync({ force: true });
  app.listen(3000, () =>
    console.log(`App listening on http://localhost:${process.env.PORT} 🚀🔥`)
  );
};

init();
